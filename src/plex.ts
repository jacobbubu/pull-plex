import * as pull from 'pull-stream'
import { pushable, Read } from '@jacobbubu/pull-pushable'
import { EventEmitter } from 'events'
import { PlexEvent, CommandType, Meta } from './event'
import { Channel } from './channel'
import { Debug } from '@jacobbubu/debug'

const DefaultLogger = Debug.create('plex')

const createPlexName = (function () {
  let counter = 0
  return () => `p${counter++}`
})()

export interface Plex {
  addListener(event: 'channel', listener: (channel: Channel) => void): this
  on(event: 'channel', listener: (channel: Channel) => void): this
  once(event: 'channel', listener: (channel: Channel) => void): this

  addListener(event: 'close', listener: (plex: Plex) => void): this
  on(event: 'close', listener: (plex: Plex) => void): this
  once(event: 'close', listener: (plex: Plex) => void): this
}

type JsonType = number | null | string

export interface MetaType {
  [key: string]: JsonType | MetaType
}

export class Plex extends EventEmitter {
  private _channels: Record<string, Channel> = {}
  private _source: Read<PlexEvent> | null = null
  private _sink: pull.Sink<PlexEvent> | null = null
  private _sourceAborted: pull.Abort = false
  private _sinkEnded: pull.EndOrError = false
  private _finished = false
  private _plexName: string
  private _meta: MetaType
  private _peerMeta: MetaType = {}

  private _logger: Debug

  constructor(meta: string | MetaType = '') {
    super()
    if (typeof meta === 'string') {
      this._plexName = meta || createPlexName()
      this._meta = { name: this._plexName }
    } else {
      this._plexName = (meta.name as string) || createPlexName()
      this._meta = { ...meta, name: this._plexName }
    }
    this._logger = DefaultLogger.ns(this._plexName)
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

  get plexName() {
    return this._plexName
  }

  get logger() {
    return this._logger
  }

  get source() {
    if (!this._source) {
      const self = this
      this._source = pushable((endOrError = true) => {
        endOrError = endOrError ?? true
        self.logger.debug('plex source closed', { endOrError })
        self._sourceAborted = endOrError
        self._finish()
      })
      this._source.push(Meta(this._meta))
    }
    return this._source
  }

  get sink() {
    if (!this._sink) {
      const self = this
      this._sink = function (rawRead: pull.Source<PlexEvent>) {
        rawRead(self._sourceAborted, function next(endOrError, event) {
          self.logger.debug('plex sink read: %o', { endOrError, event })
          if (endOrError) {
            self._sinkEnded = endOrError
            self._finish()
            return
          }
          self._processSinkData(event!)
          rawRead(self._sourceAborted, next)
        })
      }
    }
    return this._sink
  }

  abort(abort: pull.Abort = true) {
    if (!this.ended) {
      this.source.end(abort)
    }
  }

  private _processSinkData(event: PlexEvent) {
    const [command, name, payload] = event
    if (command === CommandType.Meta) {
      this._peerMeta = payload
      return
    }

    if (command === CommandType.Open) {
      this._openRemoteChannel(name)
      return
    }
    const channel = this._channels[name]
    if (!channel) {
      this.logger.warn(`Channel("${name}") doesn't exist`)
      return
    }
    switch (command) {
      case CommandType.Data:
        channel.push(payload)
        break
      case CommandType.EndOrError:
        channel.remoteAbort(payload)
        break
    }
  }

  private _openChannel(name: string, initiator: boolean) {
    this.logger.debug(`channel ${name} opened`)
    const channels = this._channels
    if (channels[name]) {
      throw new Error(`Channel(${name}) exists`)
    }

    const channel = new Channel(name, this)
    channel.on('close', (ch) => {
      delete this._channels[ch.name]
      this.logger.debug(`channel '${ch.name}' closed`)
    })
    channel.open(initiator)
    channels[name] = channel
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

    if (this.ended) {
      this._finished = true
      for (let key in Object.keys(this._channels)) {
        if (this._channels[key]) {
          this._channels[key].abort()
          delete this._channels[key]
        }
      }
      this.emit('close', this)
    }
  }

  createChannel(name: string) {
    return this._openChannel(name, true)
  }

  pushToSource(event: PlexEvent) {
    this.logger.debug('pushToSource: %o', event)
    this.source.push(event)
  }
}
