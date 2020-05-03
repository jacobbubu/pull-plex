// process.env.DEBUG = process.env.DEBUG ?? 'plex*'
// process.env.DEBUG_NAME_WIDTH = '24'

import * as pull from 'pull-stream'
import { Plex, Channel } from '../src'

const plex1 = new Plex('p1')
const plex2 = new Plex('p2')

const childPlex = plex1.createPlex('child')
childPlex.on('close', (plex) => {
  console.log(`${plex.getDisplayName()} closed`)
})

const a = childPlex.createChannel('a')

a.on('close', (ch) => {
  console.log(`${ch.getDisplayName()} closed`)
})

pull(pull.values([1, 2, 3]), a.sink)

pull(
  a.source,
  pull.collect((_, ary) => {
    console.log(`received data on channel ${a.name}/${childPlex.name}:`, ary)
  })
)

plex2.on('plex', (childPlex) => {
  childPlex.on('close', (plex) => {
    console.log(`${plex.getDisplayName()} closed`)
  })
  childPlex.on('channel', (channel: Channel) => {
    channel.on('close', (ch) => {
      console.log(`${ch.getDisplayName()} closed`)
      // childPlex.end()
    })
    pull(
      channel.source,
      pull.collect((_, ary) => {
        console.log(`received data on remote channel ${channel.name}/${childPlex.name}:`, ary)
      })
    )
    pull(pull.values([4, 5, 6]), channel.sink)
  })
})

pull(plex1, plex2, plex1)
