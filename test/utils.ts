import * as pull from 'pull-stream'

export const du = function (
  source: pull.Source<any> | any[],
  d: pull.Duplex<any, any>,
  sink: pull.Sink<any>
) {
  pull(Array.isArray(source) ? pull.values(source) : source, d.sink)
  pull(d.source, sink)
}

export const duExpect = function (src: any[], d: pull.Duplex<any, any>, res: any[]) {
  pull(pull.values(src), d.sink)
  pull(
    d.source,
    pull.collect((_, ary) => {
      expect(ary).toEqual(res)
    })
  )
}
