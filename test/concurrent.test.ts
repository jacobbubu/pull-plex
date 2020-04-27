import * as pull from 'pull-stream'
import { Plex } from '../src'
import { du, duExpect } from './utils'

describe('concurrent', () => {
  it('2-channels', (done) => {
    const plex1 = new Plex({ name: 'p1', level: 1 })
    const plex2 = new Plex({ name: 'p2', level: 1 })

    const a = plex1.createChannel('a')
    const b = plex1.createChannel('b')

    let localAClosedAt = 0
    let localBClosedAt = 0
    let remoteAClosedAt = 0
    let remoteBClosedAt = 0

    a.on('close', () => {
      localAClosedAt = Date.now()
      hasDone()
    })

    b.on('close', () => {
      localBClosedAt = Date.now()
      hasDone()
    })

    const hasDone = () => {
      if (localAClosedAt && localBClosedAt && remoteAClosedAt && remoteBClosedAt) {
        expect(remoteBClosedAt - remoteAClosedAt).toBeGreaterThan(200)
        done()
      }
    }

    plex2.on('channel', (channel) => {
      switch (channel.name) {
        case 'a':
          channel.on('close', () => {
            remoteAClosedAt = Date.now()
            hasDone()
          })
          duExpect([4, 5, 6], channel, [1, 2, 3])
          break
        case 'b':
          channel.on('close', () => {
            remoteBClosedAt = Date.now()
            hasDone()
          })
          du(
            pull.values(['A', 'B', 'C']),
            channel,
            pull(
              pull.asyncMap((data, cb) => {
                setTimeout(() => {
                  cb(null, data)
                }, 100)
              }),
              pull.collect((_, ary) => {
                expect(ary).toEqual(['a', 'b', 'c'])
              })
            )
          )
          break
      }
    })

    duExpect([1, 2, 3], a, [4, 5, 6])
    duExpect(['a', 'b', 'c'], b, ['A', 'B', 'C'])

    pull(plex1, plex2, plex1)
  })
})
