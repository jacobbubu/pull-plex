import * as pull from 'pull-stream'
import through from '@jacobbubu/pull-through'
import { CommandType, EventIndex } from './event'
import { stringify as zipStringify, parse as zipParse } from 'zipson'

export interface JsonOptions {
  zipped: boolean
  windowed: boolean
}

const preSerialization = (data: any) => {
  if (
    Array.isArray(data) &&
    (data[EventIndex.EventType] === CommandType.ChannelSinkEnd ||
      data[EventIndex.EventType] === CommandType.ChannelSourceAbort ||
      data[EventIndex.EventType] === CommandType.ChannelData ||
      data[EventIndex.EventType] === CommandType.PlexEnd ||
      data[EventIndex.EventType] === CommandType.PlexData)
  ) {
    const e = data[EventIndex.Payload]
    // transform the Error object to plain array
    if (e instanceof Error) {
      data[EventIndex.Payload] = ['__ERROR__', e.message]
    }
  }
  return data
}

const serialize = function (opts: Partial<JsonOptions> = {}) {
  const zipped = opts.zipped ?? false
  const windowed = opts.windowed ?? false
  const stringify = zipped ? zipStringify : JSON.stringify
  return through(function (data) {
    if (windowed) {
      if (!Array.isArray(data)) {
        throw new Error('Array type is required for serializing windowed data')
      }

      data.forEach((d) => {
        preSerialization(d)
      })
      this.queue(Buffer.from(stringify(data), 'binary'))
    } else {
      preSerialization(data)
      this.queue(Buffer.from(stringify(data), 'binary'))
    }
  })
}

const postParse = (data: any) => {
  if (
    Array.isArray(data) &&
    (data[EventIndex.EventType] === CommandType.ChannelSinkEnd ||
      data[EventIndex.EventType] === CommandType.ChannelSourceAbort ||
      data[EventIndex.EventType] === CommandType.ChannelData ||
      data[EventIndex.EventType] === CommandType.PlexEnd ||
      data[EventIndex.EventType] === CommandType.PlexData)
  ) {
    const e = data[EventIndex.Payload]
    if (Array.isArray(e) && e[0] === '__ERROR__') {
      data[EventIndex.Payload] = new Error(e[1])
    }
  }
  return data
}

const parse = function (opts: Partial<JsonOptions> = {}) {
  const zipped = opts.zipped ?? false
  const windowed = opts.windowed ?? false
  const parse = zipped ? zipParse : JSON.parse
  return through(function (data: Buffer | string) {
    const self = this
    const rawStr = Buffer.isBuffer(data) ? data.toString('binary') : data.toString()
    const parsed = parse(rawStr)

    if (windowed) {
      if (!Array.isArray(parsed)) {
        throw new Error(`Array type is required for parsing windowed data. raw: ${rawStr}`)
      }

      parsed.forEach((d) => {
        postParse(d)
        self.queue(d)
      })
    } else {
      postParse(parsed)
      self.queue(parsed)
    }
  })
}

export { serialize }
export { parse }
