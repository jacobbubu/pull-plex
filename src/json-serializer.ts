import * as pull from 'pull-stream'
import split from '@jacobbubu/pull-split'
import through from '@jacobbubu/pull-through'
import { CommandType, EventIndex } from './event'

const toBeTruthy = (d: any) => !!d

const serialize = function () {
  return through(function (data) {
    if (
      Array.isArray(data) &&
      (data[EventIndex.EventType] === CommandType.EndOrError ||
        data[EventIndex.EventType] === CommandType.Data)
    ) {
      const e = data[EventIndex.Payload]
      // transform the Error object to plain array
      if (e instanceof Error) {
        data[EventIndex.Payload] = ['__ERROR__', e.message]
      }
    }
    this.queue(JSON.stringify(data) + '\n')
  })
}

const parse = function () {
  return pull(
    split(),
    pull.filter(toBeTruthy),
    pull.map((data) => {
      const parsed = JSON.parse(data)
      if (
        Array.isArray(parsed) &&
        (parsed[EventIndex.EventType] === CommandType.EndOrError ||
          parsed[EventIndex.EventType] === CommandType.Data)
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
