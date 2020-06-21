import * as pull from 'pull-stream'
import { Plex, Channel, wrap, PlexEvent } from '../src'
import { window } from '@jacobbubu/pull-window'

describe('pull-plex', () => {
  it('end-spread', (done) => {
    function flatArray() {
      const buffer: any[] = []
      return (source: pull.Source<any[]>) => {
        return (end: pull.Abort, cb: pull.Source<any>) => {
          if (buffer.length > 0) {
            cb(null, buffer.shift())
          } else {
            source(end, (end, list) => {
              list?.forEach((e) => buffer.push(e))
              cb(null, buffer.shift())
            })
          }
        }
      }
    }
    function logThrough(tag: string) {
      return (source: pull.Source<PlexEvent>) => {
        return (abort: pull.Abort, cb: pull.SourceCallback<PlexEvent>) => {
          source(abort, (end, data) => {
            console.log(`${tag}: ${data}`)
            cb(end, data)
          })
        }
      }
    }

    const a = new Plex('a')
    const b = new Plex('b')

    pull(a.source, window.recent<any, any[]>(null, 10), flatArray(), logThrough('a->b'), b.sink)
    pull(b.source, window.recent<any, any[]>(null, 10), flatArray(), logThrough('b->a'), a.sink)

    const subPlexOnA1 = a.createPlex('subPlexOnA')
    subPlexOnA1.on('close', (plex: Plex) => {
      console.log('subPlexOnA1 closed')
    })
    subPlexOnA1.end(true)

    const subPlexOnA2 = a.createPlex('subPlexOnA')
    subPlexOnA2.on('close', (plex: Plex) => {
      console.log('subPlexOnA2 closed, this is unreachable')
      // throw Error("unreachable")
    })

    console.log(Date())
    setTimeout(() => {
      console.log(Date())
      done()
    }, 100)
  })
})
