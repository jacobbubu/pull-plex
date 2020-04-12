import * as pull from 'pull-stream'
import { Plex } from './plex'
import { PlexEvent } from './event'

export * from './plex'
export * from './channel'
export * from './event'
import * as json from './json-serializer'

export function wrap(plex: Plex) {
  const source = pull(plex.source, json.serialize()) as pull.Source<PlexEvent>
  const sink = pull(json.parse(), plex.sink) as pull.Sink<string>
  return { source, sink }
}
