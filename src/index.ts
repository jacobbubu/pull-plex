import * as pull from 'pull-stream'
import { Plex } from './plex'
import { encode, decode } from '@jacobbubu/pull-length-prefixed'

export * from './plex'
export * from './channel'
export * from './event'
import * as json from './json-serializer'

export function wrap(plex: Plex) {
  const source = pull(plex.source, json.serialize(), encode())
  const sink = pull(decode(), json.parse(), plex.sink)
  return { source, sink }
}
