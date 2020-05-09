import * as pull from 'pull-stream'
import { Plex, Channel, wrap } from '../src'
import through from '@jacobbubu/pull-through'
import { du, duExpect } from './utils'

describe('basic', () => {
  it('constructor', () => {
    const plex1 = new Plex('p1')
    expect(plex1.meta).toEqual({ name: plex1.name })

    const plex2 = new Plex()
    expect(plex2.meta).toEqual({ name: plex2.name })

    const plex3 = new Plex({ service: 'signal' })
    expect(plex3.meta).toEqual({ name: plex3.name, service: 'signal' })

    const plex4 = new Plex({ name: 'alice', service: 'signal' })
    expect(plex4.name).toEqual('alice')
    expect(plex4.meta).toEqual({ name: 'alice', service: 'signal' })
  })

  it('simple', (done) => {
    const plex1 = new Plex({ name: 'p1', from: 'p1' })
    const plex2 = new Plex({ name: 'p2', from: 'p2' })

    const a = plex1.createChannel('a')
    expect(a.isInitiator).toBe(true)

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
      expect(channel.isInitiator).toBe(false)
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

  it('two channels have the same name', (done) => {
    const plex1 = new Plex({ name: 'p1', from: 'p1' })
    const plex2 = new Plex({ name: 'p2', from: 'p2' })

    const conflictEvent = jest.fn((newId, channel) => {
      expect(channel.name === 'a')
      expect(channel.id !== newId)
    })

    plex1.on('channelNameConflict', conflictEvent)
    plex2.on('channelNameConflict', conflictEvent)

    const a = plex1.createChannel('a')
    const a1 = plex1.createChannel('a')

    let result: Record<string, any[]> = {}

    const hasDone = () => {
      if (Object.keys(result).length === 4) {
        expect(conflictEvent).toBeCalledTimes(2)
        const expected: Record<string, any> = {}
        expected[a.id + '/a'] = [4, 5, 6]
        expected[a1.id + '/a'] = [4, 5, 6]
        expected[a.id + `/a'`] = [1, 2, 3]
        expected[a1.id + `/a'`] = [1, 2, 3]

        expect(result).toEqual(expected)
        done()
      }
    }

    du(
      [1, 2, 3],
      a,
      pull.collect((err, ary) => {
        expect(err).toBeFalsy()
        result[a.getDisplayName()] = ary
        hasDone()
      })
    )

    du(
      [1, 2, 3],
      a1,
      pull.collect((err, ary) => {
        expect(err).toBeFalsy()
        result[a1.getDisplayName()] = ary
        hasDone()
      })
    )

    const channelCreated = jest.fn((channel: Channel) => {
      du(
        [4, 5, 6],
        channel,
        pull.collect((err, ary) => {
          expect(err).toBeFalsy()
          result[channel.getDisplayName()] = ary
          hasDone()
        })
      )
    })

    plex2.on('channel', channelCreated)

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
