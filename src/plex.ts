import * as pull from 'pull-stream'
import { pushable, Read, BufferItemCallback } from '@jacobbubu/pull-pushable'
import { EventEmitter } from 'events'
import {
  PlexEvent,
  CommandType,
  Meta,
  OpenPlex,
  PlexData,
  PlexEndOrError,
  EventIndex,
} from './event'
import { Channel } from './channel'
import { Debug } from '@jacobbubu/debug'

const DefaultLogger = Debug.create('plex')

const createPlexName = (function () {
  let counter = 0
  return () => `p${counter++}`
})()

const getPlexName = (meta?: string | MetaType | null) => {
  let name: string
  if (meta === null || meta === undefined || typeof meta === 'string') {
    name = meta || createPlexName()
  } else {
    name = (meta.name as string) || createPlexName()
  }
  return name
}

export interface Plex {
  addListener(event: 'channel', listener: (channel: Channel) => void): this
  on(event: 'channel', listener: (channel: Channel) => void): this
  once(event: 'channel', listener: (channel: Channel) => void): this

  addListener(event: 'close' | 'plex', listener: (plex: Plex) => void): this
  on(event: 'close' | 'plex', listener: (plex: Plex) => void): this
  once(event: 'close' | 'plex', listener: (plex: Plex) => void): this

  addListener(event: 'peerMeta', listener: (meta: MetaType) => void): this
  on(event: 'peerMeta', listener: (meta: MetaType) => void): this
  once(event: 'peerMeta', listener: (meta: MetaType) => void): this
}

type JsonType = number | null | string

export interface MetaType {
  [key: string]: JsonType | MetaType
}

const startTime = Date.now()

export class Plex extends EventEmitter {
  private _channels: Record<string, Channel> = {}
  private _plexes: Record<string, Plex> = {}
  private _source: Read<PlexEvent> | null = null
  private _sink: pull.Sink<PlexEvent> | null = null
  private _sourceAborted: pull.Abort = false
  private _sinkEnded: pull.EndOrError = false
  private _finished = false
  private _name: string
  private _meta: MetaType
  private _peerMeta: MetaType = {}
  private _parent: Plex | null = null
  private _initiator = true
  private _endSent = false

  private _logger: Debug

  private static createChildPlex(meta: string | MetaType | null, initiator: boolean, parent: Plex) {
    const child = new Plex(meta)
    child._parent = parent
    child._logger = parent._logger.ns(`child.getDisplayName()`)
    return child
  }

  constructor(meta?: string | MetaType | Plex | null) {
    super()
    if (meta instanceof Plex) {
      this._name = createPlexName()
      this._meta = { name: this._name }
    } else {
      this._name = getPlexName(meta)
      this._meta =
        meta === null || typeof meta === 'string'
          ? { name: this._name }
          : { ...meta, name: this._name }
    }
    this._logger = DefaultLogger.ns(this._name)
  }

  get isRoot() {
    return !this._parent
  }

  get parent() {
    return this._parent
  }

  get meta() {
    return this._meta
  }

  get peerMeta() {
    return this._peerMeta
  }

  get ended() {
    return this._sourceAborted && this._sinkEnded
  }

  get channels() {
    return this._channels
  }

  get name() {
    return this._name
  }

  get logger() {
    return this._logger
  }

  get source() {
    if (!this.isRoot) {
      throw new Error('Can not create source on sub plex')
    }
    if (!this._source) {
      const self = this
      this._source = pushable(self.getDisplayName(), (endOrError = true) => {
        endOrError = endOrError ?? true
        self.logger.debug('plex source closed', { endOrError })
        self._sourceAborted = endOrError
        self._finish()
      })
      this.pushToSource(Meta(this._meta))
    }
    return this._source
  }

  get sink() {
    if (!this.isRoot) {
      throw new Error('Can not create sink on sub plex')
    }
    if (!this._sink) {
      const self = this
      this._sink = function (rawRead: pull.Source<PlexEvent>) {
        rawRead(null, function next(endOrError, event) {
          self.logger.debug('plex sink read: %o', { endOrError, event })
          if (endOrError) {
            self._sinkEnded = endOrError
            self._finish()
            return
          }
          self._processSinkData(event!)
          rawRead(endOrError, next)
        })
      }
    }
    return this._sink
  }

  abort(abort: pull.Abort = true) {
    this.logger.debug('abort:', abort)
    if (this.isRoot) {
      if (!this.ended) {
        this.source.end(abort)
      }
    } else {
      this._finish()
    }
  }

  private _processSinkData(event: PlexEvent) {
    const [command, name, payload] = event
    if (command === CommandType.Meta) {
      this._peerMeta = payload
      this.emit('peerMeta', this._peerMeta)
      return
    }

    if (command === CommandType.OpenChannel) {
      this._openRemoteChannel(name)
      return
    }

    if (command === CommandType.OpenPlex) {
      this._openRemotePlex(payload as MetaType)
      return
    }

    if (command === CommandType.PlexData) {
      const plex = this._plexes[name]
      if (!plex) {
        this.logger.warn(`Plex("${name}") doesn't exist`)
        return
      }
      const innerEvent = event[EventIndex.Payload] as PlexEvent
      if (innerEvent[EventIndex.EventType] === CommandType.PlexEndOrError) {
        plex.remoteAbort(innerEvent[EventIndex.Payload])
      } else {
        plex._processSinkData(innerEvent)
      }
    } else {
      const channel = this._channels[name]
      if (!channel) {
        this.logger.warn(`Channel("${name}") doesn't exist`)
        return
      }
      switch (command) {
        case CommandType.ChannelData:
          channel.push(payload)
          break
        case CommandType.ChannelEndOrError:
          channel.remoteAbort(payload)
          break
      }
    }
  }

  private _openPlex(meta: string | MetaType | null, initiator: boolean = true) {
    const plex = Plex.createChildPlex(meta, initiator, this)
    plex._initiator = initiator

    const plexes = this._plexes
    if (plexes[plex.name]) {
      throw new Error(`Plex("${plex.name}") exists`)
    }

    this._plexes[plex.name] = plex

    plex.on('close', (pl) => {
      pl._sendSinkEnd(true)

      delete this._plexes[pl.name]
      this.logger.debug(`plex "${pl.name}" closed`)
    })

    if (initiator) {
      this.pushToSource(OpenPlex(plex.name, plex.meta))
    }
    this.logger.debug(`plex "${plex.name}" opened`)
    return plex
  }

  private _openRemotePlex(meta: string | MetaType | null) {
    const plex = this._openPlex(meta, false)
    this.logger.debug(`emit plex`, plex.name)
    this.emit('plex', plex)
  }

  private _openChannel(name: string, initiator: boolean) {
    const channels = this._channels
    if (channels[name]) {
      throw new Error(`Channel("${name}") exists`)
    }

    const channel = new Channel(name, this)
    channel.on('close', (ch) => {
      delete this._channels[ch.name]
      this.logger.debug(`channel "${ch.name}" closed`)
    })
    channel.open(initiator)
    channels[name] = channel

    this.logger.debug(`channel "${name}" opened`)
    return channel
  }

  private _openRemoteChannel(name: string) {
    const channel = this._openChannel(name, false)
    this.logger.debug(`emit channel`, channel.name)
    this.emit('channel', channel)
    return channel
  }

  private _finish() {
    this.logger.debug(`_finish: %o`, {
      sourceAborted: this._sourceAborted,
      sinkEnded: this._sinkEnded,
    })
    if (this._finished) return

    const clean = () => {
      this._finished = true
      for (let key in Object.keys(this._channels)) {
        if (this._channels[key]) {
          this._channels[key].abort()
          delete this._channels[key]
        }
      }
      for (let key in Object.keys(this._plexes)) {
        if (this._plexes[key]) {
          this._plexes[key].abort()
          delete this._plexes[key]
        }
      }
      this.emit('close', this)
    }

    if (!this.isRoot) {
      this._sourceAborted = true
      this._sinkEnded = true
    }
    if (this.ended) {
      clean()
    }
  }

  private remoteAbort(abort: pull.Abort = true) {
    this.logger.debug('remoteAbort:', abort)
    this._finish()
  }

  private _sendSinkEnd(endOrError: pull.EndOrError, cb?: BufferItemCallback) {
    if (!this.isRoot) {
      if (this._endSent) return
      this._endSent = true
      this.pushToSource(PlexEndOrError(this.name, endOrError), cb)
    }
  }

  createChannel(name: string) {
    return this._openChannel(name, true)
  }

  createPlex(meta: string | MetaType | null = '') {
    return this._openPlex(meta, true)
  }

  pushToSource(event: PlexEvent, cb?: BufferItemCallback) {
    if (this.isRoot) {
      this.logger.debug('pushToSource: %o', event)
      this.source.push(event, cb)
    } else {
      this.parent!.pushToSource(PlexData(this.name, event), cb)
    }
  }

  getDisplayName() {
    return `|${this._name}${this._initiator ? '' : "'"}|`
  }
}