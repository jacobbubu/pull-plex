import * as pull from 'pull-stream'
import * as net from 'net'
import { Plex, Channel, wrap } from '../src'
const toPull = require('stream-to-pull-stream')

describe('net', () => {
  it('simple', (done) => {
    const PORT = 9988

    const serverMeta = { name: 'server', serviceName: 'proxy' }
    const clientMeta = { name: 'client', serviceName: 'signal' }

    let result1: any[]
    let result2: any[]

    let serverSocket: net.Socket | null = null
    const hasDone = () => {
      if (result1?.length > 0 && result2?.length > 0) {
        expect(result1).toEqual([4, 5, 6])
        expect(result2).toEqual([1, 2, 3])
        server.close(done)
      }
    }

    const server = net
      .createServer((socket) => {
        serverSocket = socket

        const client = toPull.duplex(socket) as pull.Duplex<Buffer, Buffer>
        const plexServer = new Plex(serverMeta)
        plexServer.on('channel', (channel: Channel) => {
          pull(
            channel.source,
            pull.collect((err, ary) => {
              expect(err).toBeFalsy()
              expect(plexServer.meta).toEqual(serverMeta)
              expect(plexServer.peerMeta).toEqual(clientMeta)
              result2 = ary
              hasDone()
            })
          )
          pull(pull.values([4, 5, 6]), channel.sink)
        })

        pull(client, wrap(plexServer), client)
      })
      .listen(PORT)

    const rawClient = net.createConnection({ port: PORT }, () => {
      const client = toPull.duplex(rawClient) as pull.Duplex<Buffer, Buffer>
      const plexClient = new Plex(clientMeta)
      const a = plexClient.createChannel('a')

      a.on('close', (_) => rawClient.destroy())

      pull(pull.values([1, 2, 3]), a.sink)
      pull(
        a.source,
        pull.collect((err, ary) => {
          expect(err).toBeFalsy()
          expect(plexClient.meta).toEqual(clientMeta)
          expect(plexClient.peerMeta).toEqual(serverMeta)
          result1 = ary
          hasDone()
        })
      )

      pull(client, wrap(plexClient), client)
    })
  })
})
