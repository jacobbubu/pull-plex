import * as pull from 'pull-stream'
import { Plex, Channel } from '../src'
import { link } from './utils'

describe('basic', () => {
  it('simple', (done) => {
    const plex1 = new Plex('p1')
    const plex2 = new Plex('p2')

    const a = plex1.createChannel('a')

    let result1: any[]
    let result2: any[]

    const hasDone = () => {
      if (result1 && result2) {
        expect(result1).toEqual([4, 5, 6])
        expect(result2).toEqual([1, 2, 3])
        done()
      }
    }

    pull(pull.values([1, 2, 3]), a.sink)
    pull(
      a.source,
      pull.collect((err, ary) => {
        expect(err).toBeFalsy()
        result1 = ary
        hasDone()
      })
    )

    plex2.on('channel', (channel: Channel) => {
      pull(
        channel.source,
        pull.collect((err, ary) => {
          expect(err).toBeFalsy()
          result2 = ary
        })
      )
      pull(pull.values([4, 5, 6]), channel.sink)
    })

    link(plex1, plex2)
  })
})
