import * as assert from 'assert'
import * as pull from 'pull-stream'
import { pushable, Read, BufferItemCallback } from '@jacobbubu/pull-pushable'
import { EventEmitter } from 'events'
import { Debug } from '@jacobbubu/debug'
import { Plex } from './plex'
import * as Event from './event'

export interface Channel {
  addListener(event: 'open', listener: (initiator: boolean, channel: Channel) => void): this
  on(event: 'open', listener: (initiator: boolean, channel: Channel) => void): this
  once(event: 'open', listener: (initiator: boolean, channel: Channel) => void): this

  addListener(event: 'close', listener: (channel: Channel) => void): this
  on(event: 'close', listener: (channel: Channel) => void): this
  once(event: 'close', listener: (channel: Channel) => void): this
}

export class Channel extends EventEmitter {
  private _source: Read<any> | null = null
  private _sink: pull.Sink<any> | null = null
  private _opened = false
  private _initiator = true

  private _askForEnd: pull.Abort = false
  private _sourceAborted: pull.Abort = false
  private _sinkEnded: pull.EndOrError = false
  private _finished = false
  private _sinkEndSent = false
  private _sourceAbortSent = false
  private _logger: Debug

  constructor(
    public readonly id: string,
    public readonly name: string,
    private readonly plex: Plex,
    public readonly opts?: any
  ) {
    super()
    this._logger = plex.logger.ns(name)
  }

  get logger() {
    return this._logger
  }

  get opened() {
    return this._opened
  }

  get isInitiator() {
    return this._initiator
  }

  get ended() {
    return this._sourceAborted && this._sinkEnded
  }

  get source() {
    if (!this._source) {
      const self = this
      this._source = pushable(
        `${self.getDisplayName()}${self._initiator ? '' : "'"}`,
        (endOrError = true) => {
          endOrError = endOrError ?? true
          self.logger.debug('source ended', { endOrError })
          this._sendSourceAbort(endOrError)
          self._sourceAborted = endOrError
          self._finish()
        }
      )
    }
    return this._source
  }

  get sink() {
    if (!this._sink) {
      const self = this

      this._sink = function (rawRead: pull.Source<any>) {
        rawRead(self._askForEnd, function next(endOrError, data) {
          self.logger.debug(`sink read(${self._askForEnd})`, { endOrError, data })

          if (endOrError) {
            self._sinkEnded = endOrError
            self._sendSinkEnd(endOrError, () => {
              self._finish()
            })
            return
          }
          self._sendSinkData(data, (endOrError) => {
            if (!self._sinkEnded) {
              rawRead(self._askForEnd || endOrError, next)
            }
          })
        })
      }
    }
    return this._sink
  }

  push(payload: any, cb?: BufferItemCallback) {
    this.logger.debug('push to channel source:', payload)
    this.source.push(payload, cb)
  }

  open(initiator = true) {
    if (this._opened) {
      throw new Error(`Channel(${this.getDisplayName()})already opened`)
    }

    this._initiator = initiator
    this._logger = this.plex.logger.ns(this.getDisplayName())

    if (initiator) {
      this.plex.pushToSource(Event.OpenChannel(this.id, this.name, this.opts))
    }
    this._opened = true
    this.emit('open', initiator, this)
  }

  // manually end this channel (both source and sink of channel)
  end(abort: pull.Abort = true) {
    this.logger.debug('end:', abort)

    this._askForEnd = abort
    this.source.end(abort)
  }

  remoteSinkEnd(abort: pull.Abort = true) {
    // half-close the source part of channel
    // and leave the sink part of channel
    this.logger.debug('remoteEnd:', abort)
    if (!this._sourceAborted) {
      this.source.end(abort)
    }
  }

  remoteSourceAbort(abort: pull.Abort = true) {
    this.logger.debug('remoteSourceAbort:', abort)
    this._askForEnd = abort
  }

  private _finish() {
    this.logger.debug(`_finish: %o`, {
      sourceAborted: this._sourceAborted,
      sinkEnded: this._sinkEnded,
    })
    if (this._finished) return
    if (this.ended) {
      this._finished = true
      this.emit('close', this)
    }
  }

  private _sendSinkData(data: any, cb?: BufferItemCallback) {
    assert(this.opened, `Channel("${this.getDisplayName()}") hasn't opened`)
    if (this._sinkEndSent) return cb?.(true)
    this.plex.pushToSource(Event.ChannelData(this.id, data), cb)
  }

  private _sendSinkEnd(endOrError: pull.EndOrError, cb?: BufferItemCallback) {
    assert(this.opened, `Channel("${this.getDisplayName()}") hasn't opened`)
    if (this._sinkEndSent) return cb?.(true)
    this._sinkEndSent = true
    this.plex.pushToSource(Event.ChannelSinkEnd(this.id, endOrError), cb)
  }

  private _sendSourceAbort(endOrError: pull.EndOrError) {
    assert(this.opened, `Channel("${this.getDisplayName()}") hasn't opened`)
    if (this._sourceAbortSent) return
    this._sourceAbortSent = true
    this.plex.pushToSource(Event.ChannelSourceAbort(this.id, endOrError))
  }

  getDisplayName() {
    return `${this.id}/${this.name}${this._initiator ? '' : "'"}`
  }
}
