process.env.DEBUG = process.env.DEBUG ?? 'plex*'
process.env.DEBUG_NAME_WIDTH = '24'

import * as pull from 'pull-stream'
import { Plex, Channel } from '../src'

const main = function () {
  return new Promise((resolve) => {
    const generator = function (initial: string) {
      let counter = 0
      return () => `${initial}-${++counter}`
    }
    const d1 = {
      source: pull(
        pull.infinite(generator('d1')),
        pull.asyncMap((data, cb) => {
          setTimeout(() => cb(null, data), 30)
        })
      ),
      sink: pull.drain(),
    }

    const d2 = {
      source: pull(
        pull.infinite(generator('d2')),
        pull.asyncMap((data, cb) => {
          setTimeout(() => cb(null, data), 30)
        })
      ),
      sink: pull.drain(),
    }

    const plex1 = new Plex({ name: 'p1', level: 1 })
    const plex2 = new Plex({ name: 'p2', level: 1 })

    let localChildPlexClosed = false
    let remoteChildPlexClosed = false
    let localChannelClosed = false
    let remoteChannelClosed = false

    const hasDone = () => {
      if (
        localChildPlexClosed &&
        remoteChildPlexClosed &&
        localChannelClosed &&
        remoteChannelClosed
      ) {
        resolve()
      }
    }

    const childPlex = plex1.createPlex({ name: 'child', level: 2 })
    childPlex.on('close', () => {
      localChildPlexClosed = true
      hasDone()
    })

    const a = childPlex.createChannel('a')
    a.on('close', () => {
      localChannelClosed = true
      hasDone()
    })
    pull(a, d1, a)

    plex2.on('plex', (remoteChild) => {
      remoteChild.on('close', (_) => {
        remoteChildPlexClosed = true
        hasDone()
      })
      remoteChild.on('channel', (channel: Channel) => {
        channel.on('close', (ch) => {
          remoteChannelClosed = true
          remoteChild.end()
          hasDone()
        })

        setTimeout(() => {
          a.end()
        }, 100)

        pull(channel, d2, channel)
      })
    })

    pull(plex1, plex2, plex1)
  })
}

// tslint:disable-next-line no-floating-promises
main()
