// process.env.DEBUG = process.env.DEBUG ?? 'plex*'
// process.env.DEBUG_NAME_WIDTH = '12'

import * as pull from 'pull-stream'
import { Plex, Channel } from '../src'

const plex1 = new Plex('p1')
const plex2 = new Plex('p2')

const a = plex1.createChannel('a')
pull(pull.values(['l1', 'l2', 'l3']), a.sink)
pull(
  a.source,
  pull.collect((_, ary) => {
    console.log(`received data on channel ${a.name}/${plex1.name}:`, ary)
  })
)

plex2.on('channel', (channel: Channel) => {
  pull(
    channel.source,
    pull.collect((_, ary) => {
      console.log(`received data on channel ${channel.name}/${plex2.name}:`, ary)
    })
  )
  pull(pull.values(['r1', 'r2', 'r3']), channel.sink)
})

pull(plex1, plex2, plex1)
