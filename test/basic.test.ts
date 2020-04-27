import * as pull from 'pull-stream'
import { Plex, Channel, wrap } from '../src'
import through from '@jacobbubu/pull-through'
import { du } from './utils'

describe('basic', () => {
  it('constructor', () => {
    const plex1 = new Plex('p1')
    expect(plex1.name).toEqual('p1')
    expect(plex1.meta).toEqual({ name: 'p1' })

    const plex2 = new Plex()
    expect(plex2.name).toEqual('p0')
    expect(plex2.meta).toEqual({ name: 'p0' })

    const plex3 = new Plex({ service: 'signal' })
    expect(plex3.name).toEqual('p1')
    expect(plex3.meta).toEqual({ name: 'p1', service: 'signal' })

    const plex4 = new Plex({ name: 'alice', service: 'signal' })
    expect(plex4.name).toEqual('alice')
    expect(plex4.meta).toEqual({ name: 'alice', service: 'signal' })
  })

  it('conflict channel name', () => {
    const plex1 = new Plex({ from: 'p1' })

    const a = plex1.createChannel('a')
    expect(() => plex1.createChannel('a')).toThrowError()
  })

  it('simple', (done) => {
    const plex1 = new Plex({ name: 'p1', from: 'p1' })
    const plex2 = new Plex({ name: 'p2', from: 'p2' })

    const a = plex1.createChannel('a')

    let result1: any[]
    let result2: any[]

    const hasDone = () => {
      if (result1 && result2) {
        expect(plex1.peerMeta).toEqual(plex2.meta)
        expect(plex2.peerMeta).toEqual(plex1.meta)
        expect(result1).toEqual([4, 5, 6])
        expect(result2).toEqual([1, 2, 3])
        done()
      }
    }

    const peerMetaEvent = jest.fn((meta) => expect(meta).toEqual({ name: 'p2', from: 'p2' }))
    plex1.on('peerMeta', peerMetaEvent)

    du(
      [1, 2, 3],
      a,
      pull.collect((err, ary) => {
        expect(err).toBeFalsy()
        result1 = ary
        hasDone()
      })
    )

    plex2.on('channel', (channel: Channel) => {
      du(
        [4, 5, 6],
        channel,
        pull.collect((err, ary) => {
          expect(err).toBeFalsy()
          result2 = ary
          hasDone()
        })
      )
    })

    pull(plex1, plex2, plex1)
  })

  it('serialization', (done) => {
    const plex1 = new Plex({ from: 'p1' })
    const plex2 = new Plex({ from: 'p2' })

    const a = plex1.createChannel('a')

    let result1: any[]
    let result2: any[]

    const hasDone = () => {
      if (result1 && result2) {
        expect(plex1.peerMeta).toEqual(plex2.meta)
        expect(plex2.peerMeta).toEqual(plex1.meta)
        expect(result1).toEqual([4, 5, 6])
        expect(result2).toEqual([1, 2, 3])
        done()
      }
    }

    du(
      [1, 2, 3],
      a,
      pull.collect((err, ary) => {
        expect(err).toBeFalsy()
        result1 = ary
        hasDone()
      })
    )

    plex2.on('channel', (channel: Channel) => {
      du(
        [4, 5, 6],
        channel,
        pull.collect((err, ary) => {
          expect(err).toBeFalsy()
          result2 = ary
          hasDone()
        })
      )
    })

    const wrappedPlex = wrap(plex1)
    pull(wrappedPlex, wrap(plex2), wrappedPlex)
  })

  it('error serialization', (done) => {
    const plex1 = new Plex({ from: 'p1' })
    const plex2 = new Plex({ from: 'p2' })

    const a = plex1.createChannel('a')

    let result1: any[]
    let result2: any[]

    const hasDone = () => {
      if (result1 && result2) {
        expect(plex1.peerMeta).toEqual(plex2.meta)
        expect(plex2.peerMeta).toEqual(plex1.meta)
        expect(result1[0]).toBe(4)
        expect(result1[1]).toBeInstanceOf(Error)
        expect(result1[1].message).toBe('error')

        expect(result2).toEqual([1])
        done()
      }
    }

    du(
      pull(
        pull.values([1, 2, 3]),
        through(function (d) {
          if (d === 2) {
            this.emit('error', new Error('error'))
          } else {
            this.queue(d)
          }
        })
      ),
      a,
      pull.collect((err, ary) => {
        expect(err).toBeFalsy()
        result1 = ary
        hasDone()
      })
    )

    plex2.on('channel', (channel: Channel) => {
      du(
        [4, new Error('error')],
        channel,
        pull.collect((err, ary) => {
          expect(err).toBeTruthy()
          expect(err).toBeInstanceOf(Error)
          expect((err as Error).message).toBe('error')
          result2 = ary
        })
      )
    })

    const wrappedPlex = wrap(plex1)
    pull(wrappedPlex, wrap(plex2), wrappedPlex)
  })
})
