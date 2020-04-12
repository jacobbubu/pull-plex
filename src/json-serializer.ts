import * as pull from 'pull-stream'
import split from '@jacobbubu/pull-split'
import through from '@jacobbubu/pull-through'

const toBeTruthy = (d: any) => !!d

const serialize = function () {
  return through(function (data) {
    this.queue(JSON.stringify(data) + '\n')
  })
}

const parse = function () {
  return pull(split(), pull.filter(toBeTruthy), pull.map(JSON.parse))
}

export { serialize }
export { parse }
