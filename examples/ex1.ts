// process.env.DEBUG = process.env.DEBUG ?? 'plex*'
// process.env.DEBUG_NAME_WIDTH = '12'

import * as pull from 'pull-stream'
import { Plex, Channel } from '../src'

const plex1 = new Plex('p1')
const plex2 = new Plex('p2')

const a = plex1.createChannel('a')
pull(pull.values([1, 2, 3]), a.sink)
pull(
  a.source,
  pull.collect((_, ary) => {
    console.log(`received data on channel ${a.name}/${plex1.plexName}:`, ary)
  })
)

plex2.on('channel', (channel: Channel) => {
  pull(
    channel.source,
    pull.collect((_, ary) => {
      console.log(`received data on channel ${channel.name}/${plex2.plexName}:`, ary)
    })
  )
  pull(pull.values([4, 5, 6]), channel.sink)
})

pull(plex1, plex2, plex1)
