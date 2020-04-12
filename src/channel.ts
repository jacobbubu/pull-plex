import * as assert from 'assert'
import * as pull from 'pull-stream'
import { pushable, Read } from '@jacobbubu/pull-pushable'
import { EventEmitter } from 'events'
import { Debug } from '@jacobbubu/debug'
import { Plex } from './plex'
import * as Event from './event'

export class Channel extends EventEmitter {
  private _source: Read<any> | null = null
  private _sink: pull.Sink<any> | null = null
  private _opened = false
  private _initiator = true

  private _sourceAborted: pull.Abort = false
  private _sinkEnded: pull.EndOrError = false
  private _finished = false
  private _endSent = false
  private _logger: Debug

  constructor(public readonly name: string, private readonly plex: Plex) {
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

  get endReason() {
    return this._sourceAborted || this._sinkEnded
  }

  get source() {
    if (!this._source) {
      const self = this
      this._source = pushable((endOrError = true) => {
        endOrError = endOrError ?? true
        self.logger.debug('source ended', { endOrError })
        self._sourceAborted = endOrError
        self._finish()
      })
    }
    return this._source
  }

  get sink() {
    if (!this._sink) {
      const self = this
      const plex = this.plex
      this._sink = function (rawRead: pull.Source<any>) {
        rawRead(self._sourceAborted, function next(endOrError, data) {
          self.logger.debug('sink read', { endOrError, data })
          // 如果上游要结束，不仅 channel 要结束，还要把这件事转换成 plex 事件，传递到对端
          if (endOrError) {
            self._sinkEnded = endOrError
            self._sendSinkEnd(endOrError)
            self._finish()
            return
          }
          plex.pushToSource(Event.Data(self.name, data))

          rawRead(self._sourceAborted, next)
        })
      }
    }
    return this._sink
  }

  push(payload: any) {
    this.logger.debug('push: ', payload)
    this.source.push(payload)
  }

  open(initiator = true) {
    if (this._opened) {
      throw new Error(`Channel(${this.name})already opened`)
    }

    this._initiator = initiator
    if (initiator) {
      this.plex.pushToSource(Event.Open(this.name))
    }
    this._opened = true
    this.emit('open', initiator, this)
  }

  // 给 channel 的外部消费者使用，但是代表的是本地的终止行为
  abort(abort: pull.Abort = true) {
    if (!this.ended) {
      this.source.end(abort)
    }
  }

  // 由 plex 收到的 LocalEndOrError 和 RemoteEndOrError 触发的终止行为
  remoteAbort(abort: pull.Abort = true) {
    this.logger.debug('remoteAbort: ', abort)
    if (!this.ended) {
      this.source.end(abort)
    }
  }

  private _finish() {
    if (this._finished) return
    this._finished = true
    if (this.ended) {
      this.emit('close', this)
    }
  }

  private _sendSinkEnd(endOrError: pull.EndOrError) {
    assert(this.opened, `Channel("${this.name}") hasn't opened`)
    if (this._endSent) return
    this._endSent = true
    this.plex.pushToSource(Event.EndOrError(this.name, endOrError))
  }
}
