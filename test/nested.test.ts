import * as pull from 'pull-stream'
import { Plex, Channel } from '../src'
import { duExpect } from './utils'

describe('pull-plex', () => {
  it('nested', (done) => {
    const plex1 = new Plex({ name: 'p1', level: 1 })
    const plex1PeerMetaEvent = jest.fn()
    const plex2 = new Plex({ name: 'p2', level: 1 })
    const plex2PeerMetaEvent = jest.fn()

    let localChildPlexClosed = false
    let remoteChildPlexClosed = false
    let localChannelClosed = false

    const hasDone = () => {
      if (localChildPlexClosed && remoteChildPlexClosed && localChannelClosed) {
        done()
      }
    }

    plex1.on('peerMeta', plex1PeerMetaEvent)
    plex2.on('peerMeta', plex2PeerMetaEvent)

    const childPlex = plex1.createPlex({ name: 'child', level: 2 })
    childPlex.on('close', () => {
      localChildPlexClosed = true
      hasDone()
    })
    expect(childPlex.meta).toEqual({ name: 'child', level: 2 })

    const a = childPlex.createChannel('a')
    a.on('close', () => {
      localChannelClosed = true
      hasDone()
    })
    duExpect([1, 2, 3], a, [4, 5, 6])

    plex2.on('plex', (remoteChild) => {
      expect(remoteChild.meta).toEqual({ name: 'child', level: 2 })

      remoteChild.on('close', (_) => {
        expect(plex1PeerMetaEvent).toBeCalledTimes(1)
        expect(plex1PeerMetaEvent.mock.calls[0][0]).toEqual({ name: 'p2', level: 1 })
        expect(plex2PeerMetaEvent).toBeCalledTimes(1)
        expect(plex2PeerMetaEvent.mock.calls[0][0]).toEqual({ name: 'p1', level: 1 })

        remoteChildPlexClosed = true
        hasDone()
      })
      remoteChild.on('channel', (channel: Channel) => {
        channel.on('close', (ch) => {
          remoteChild.end()
        })
        duExpect([4, 5, 6], channel, [1, 2, 3])
      })
    })

    pull(plex1, plex2, plex1)
  })

  it('channel end on child plex', (done) => {
    const generator = function (initial: string) {
      return () => initial
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
        done()
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
})
