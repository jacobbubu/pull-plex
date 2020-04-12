import * as pull from 'pull-stream'

const link = (plex1: pull.DuplexThrough<any, any>, plex2: pull.DuplexThrough<any, any>) => {
  pull(plex1, plex2)
  pull(plex2, plex1)
}

export { link }
