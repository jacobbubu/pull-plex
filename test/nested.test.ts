import * as pull from 'pull-stream'
import { Plex, Channel, Meta } from '../src'

describe('nested', () => {
  it('basic', (done) => {
    const plex1 = new Plex({ name: 'p1', level: 1 })
    const plex1PeerMetaEvent = jest.fn()
    const plex2 = new Plex({ name: 'p2', level: 1 })
    const plex2PeerMetaEvent = jest.fn()

    let localChildClosed = false
    let remoteChildClosed = false
    let localChannelClosed = false

    const hasDone = () => {
      if (localChildClosed && remoteChildClosed && localChannelClosed) {
        done()
      }
    }

    plex1.on('peerMeta', plex1PeerMetaEvent)
    plex2.on('peerMeta', plex2PeerMetaEvent)

    const childPlex = plex1.createPlex({ name: 'child', level: 2 })
    childPlex.on('close', () => {
      localChildClosed = true
      hasDone()
    })
    expect(childPlex.meta).toEqual({ name: 'child', level: 2 })

    const a = childPlex.createChannel('a')
    a.on('close', () => {
      localChannelClosed = true
      hasDone()
    })
    pull(pull.values([1, 2, 3]), a.sink)
    pull(
      a.source,
      pull.collect((_, ary) => {
        expect(ary).toEqual([4, 5, 6])
      })
    )

    plex2.on('plex', (remoteChild) => {
      expect(remoteChild.meta).toEqual({ name: 'child', level: 2 })

      remoteChild.on('close', (_) => {
        expect(plex1PeerMetaEvent).toBeCalledTimes(1)
        expect(plex1PeerMetaEvent.mock.calls[0][0]).toEqual({ name: 'p2', level: 1 })
        expect(plex2PeerMetaEvent).toBeCalledTimes(1)
        expect(plex2PeerMetaEvent.mock.calls[0][0]).toEqual({ name: 'p1', level: 1 })

        remoteChildClosed = true
        hasDone()
      })
      remoteChild.on('channel', (channel: Channel) => {
        channel.on('close', (ch) => {
          remoteChild.abort()
        })
        pull(
          channel.source,
          pull.collect((_, ary) => {
            expect(ary).toEqual([1, 2, 3])
          })
        )
        pull(pull.values([4, 5, 6]), channel.sink)
      })
    })

    pull(plex1, plex2, plex1)
  })
})
