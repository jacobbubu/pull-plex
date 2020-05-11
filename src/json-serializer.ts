import * as pull from 'pull-stream'
import through from '@jacobbubu/pull-through'
import { CommandType, EventIndex } from './event'

const serialize = function () {
  return through(function (data) {
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
    this.queue(Buffer.from(JSON.stringify(data)))
  })
}

const parse = function () {
  return pull(
    pull.map((data: Buffer | string) => {
      const parsed = JSON.parse(data.toString())
      if (
        Array.isArray(parsed) &&
        (parsed[EventIndex.EventType] === CommandType.ChannelSinkEnd ||
          parsed[EventIndex.EventType] === CommandType.ChannelSourceAbort ||
          parsed[EventIndex.EventType] === CommandType.ChannelData ||
          parsed[EventIndex.EventType] === CommandType.PlexEnd ||
          parsed[EventIndex.EventType] === CommandType.PlexData)
      ) {
        const e = parsed[EventIndex.Payload]
        if (Array.isArray(e) && e[0] === '__ERROR__') {
          parsed[EventIndex.Payload] = new Error(e[1])
        }
      }
      return parsed
    })
  )
}

export { serialize }
export { parse }
