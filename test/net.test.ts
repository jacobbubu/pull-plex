import * as pull from 'pull-stream'
import * as net from 'net'
import { Plex, Channel, wrap } from '../src'
const toPull = require('stream-to-pull-stream')

describe('net', () => {
  it('simple', (done) => {
    const PORT = 9988

    let result1: any[]
    let result2: any[]

    const hasDone = () => {
      if (result1 && result2) {
        expect(result1).toEqual([4, 5, 6])
        expect(result2).toEqual([1, 2, 3])
        server.close()
        done()
      }
    }

    const server = net
      .createServer((socket) => {
        const client = toPull.duplex(socket) as pull.Duplex<Buffer, Buffer>
        const plexServer = new Plex('server')
        plexServer.on('channel', (channel: Channel) => {
          pull(
            channel.source,
            pull.collect((err, ary) => {
              expect(err).toBeFalsy()
              result2 = ary
            })
          )
          pull(pull.values([4, 5, 6]), channel.sink)
        })

        pull(client, wrap(plexServer), client)
      })
      .listen(PORT)

    const rawClient = net.createConnection({ port: PORT }, () => {
      const client = toPull.duplex(rawClient) as pull.Duplex<Buffer, Buffer>
      const plexClient = new Plex('client')
      const a = plexClient.createChannel('a')

      pull(pull.values([1, 2, 3]), a.sink)
      pull(
        a.source,
        pull.collect((err, ary) => {
          expect(err).toBeFalsy()
          result1 = ary
          hasDone()
        })
      )

      pull(client, wrap(plexClient), client)
    })
  })
})
