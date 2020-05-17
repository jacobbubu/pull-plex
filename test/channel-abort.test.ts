import * as pull from 'pull-stream'
import { Plex } from '../src'

describe('pull-plex', () => {
  it('channel-abort', (done) => {
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

    const plex1 = new Plex({ from: 'p1' })
    const plex2 = new Plex({ from: 'p2' })
    let aClosed = false
    let a1Closed = false

    const hasDone = () => {
      if (aClosed && a1Closed) done()
    }

    const a = plex1.createChannel('a')
    pull(a, d1, a)

    a.on('close', () => {
      aClosed = true
      hasDone()
    })

    plex2.on('channel', (a1) => {
      a1.on('close', () => {
        a1Closed = true
        hasDone()
      })

      setTimeout(() => {
        a.end()
        // a1.end()
      }, 100)

      pull(a1, d2, a1)
    })

    pull(plex1, plex2, plex1)
  })
})
