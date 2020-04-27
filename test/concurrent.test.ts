import * as pull from 'pull-stream'
import { Plex, Channel, Meta } from '../src'

describe('concurrent', () => {
  it('2-channels', (done) => {
    const plex1 = new Plex({ name: 'p1', level: 1 })
    const plex2 = new Plex({ name: 'p2', level: 1 })

    const a = plex1.createChannel('a')
    const b = plex2.createChannel('b')

    let localAClosedAt = 0
    let localBClosedAt = 0

    a.on('close', () => {
      localAClosedAt = Date.now()
      hasDone()
    })

    b.on('close', () => {
      localBClosedAt = Date.now()
      hasDone()
    })

    const hasDone = () => {
      if (localAClosedAt && localBClosedAt) {
        expect(localBClosedAt - localAClosedAt).toBeGreaterThan(200)
        done()
      }
    }

    plex1.on('channel', (remoteB) => {
      pull(pull.values(['A', 'B', 'C']), remoteB.sink)
      pull(
        remoteB.source,
        pull.asyncMap((data, cb) => {
          setTimeout(() => {
            cb(null, data)
          }, 100)
        }),
        pull.collect((_, ary) => {
          expect(ary).toEqual(['a', 'b', 'c'])
        })
      )
    })

    plex2.on('channel', (remoteA) => {
      pull(pull.values([4, 5, 6]), remoteA.sink)
      pull(
        remoteA.source,
        pull.collect((_, ary) => {
          expect(ary).toEqual([1, 2, 3])
        })
      )
    })

    pull(pull.values([1, 2, 3]), a.sink)
    pull(
      a.source,
      pull.collect((_, ary) => {
        expect(ary).toEqual([4, 5, 6])
      })
    )

    pull(pull.values(['a', 'b', 'c']), b.sink)
    pull(
      b.source,
      pull.collect((_, ary) => {
        expect(ary).toEqual(['A', 'B', 'C'])
      })
    )

    pull(plex1, plex2, plex1)
  })
})
