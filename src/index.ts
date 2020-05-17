import * as pull from 'pull-stream'
import { Plex } from './plex'
import { encode, decode } from '@jacobbubu/pull-length-prefixed'
import { window } from '@jacobbubu/pull-window'

export * from './plex'
export * from './channel'
export * from './event'
import * as json from './json-serializer'

export function wrap(plex: Plex, opts: Partial<json.JsonOptions> = {}) {
  const zipped = opts.zipped ?? false
  let sourceThroughs = []
  if (zipped) {
    sourceThroughs = [
      plex.source,
      window.recent<any, any[]>(null, 100),
      json.serialize({ ...opts, windowed: true }),
      encode(),
    ]
  } else {
    sourceThroughs = [plex.source, json.serialize(opts), encode()]
  }
  let sinkThroughs = []
  if (zipped) {
    sinkThroughs = [decode(), json.parse({ ...opts, windowed: true }), plex.sink]
  } else {
    sinkThroughs = [decode(), json.parse(opts), plex.sink]
  }
  const source = pull.apply(pull, sourceThroughs) as pull.Source<Buffer>
  const sink = pull.apply(pull, sinkThroughs) as pull.Sink<Buffer>
  return { source, sink }
}
