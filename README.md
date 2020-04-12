# @jacobbubu/pull-plex

[![Build Status](https://github.com/jacobbubu/pull-plex/workflows/Build%20and%20Release/badge.svg)](https://github.com/jacobbubu/pull-plex/actions?query=workflow%3A%22Build+and+Release%22)
[![Coverage Status](https://coveralls.io/repos/github/jacobbubu/pull-plex/badge.svg)](https://coveralls.io/github/jacobbubu/pull-plex)
[![npm](https://img.shields.io/npm/v/@jacobbubu/pull-plex.svg)](https://www.npmjs.com/package/@jacobbubu/pull-plex/)

> A multiplex solution for pull-stream.

# Usage

``` ts
import * as pull from 'pull-stream'
import { Plex, Channel } from '../src'

const plex1 = new Plex('p1')
const plex2 = new Plex('p2')

const a = plex1.createChannel('a')
pull(pull.values([1, 2, 3]), a.sink)
pull(
  a.source,
  pull.collect((_, ary) => {
    console.log(`received data on channel ${a.name}/${plex1.plexName}:`, ary)
  })
)

plex2.on('channel', (channel: Channel) => {
  pull(
    channel.source,
    pull.collect((_, ary) => {
      console.log(`received data on channel ${channel.name}/${plex2.plexName}:`, ary)
    })
  )
  pull(pull.values([4, 5, 6]), channel.sink)
})

pull(plex1, plex2)
pull(plex2, plex1)
```

