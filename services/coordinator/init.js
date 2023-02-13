import Statsd from 'hot-shots'
import Koa from 'koa'
import got from 'got'

const app = new Koa()
const statsdClient = new Statsd({ host: 'telegraf', port: 8125, prefix: 'techtalk.', telegraf:true, errorHandler: (e) => console.log(e), protocol: 'udp'})

let concurrency = 0

function allocateArray(size) {
  /**
   * This function exists because I needed a way to create data in the heap.
   * Using `crypto.randomBytes` allocates them in the `externalMemory`.
   */
  const array = new Array(size)
  array.forEach((e, index) => array[index] = 'A')

  return array
}

app.use(async (ctx, next) => {
  ctx.state = {
    gibberish: allocateArray(1024 * 1024)
  }

  await next()
})

app.use(async (_ctx, next) => {
  concurrency += 1
  statsdClient.increment('requests', 1, { service: 'coordinator' })
  statsdClient.gauge('concurrency', concurrency, { service: 'coordinator' })

  await next()
  concurrency -= 1

  statsdClient.gauge('concurrency', concurrency, { service: 'coordinator' })
})

// response

app.use(async ctx => {
  await got.get('http://orders:3000')
})

setInterval(() => {
  const {heapUsed, heapTotal} = process.memoryUsage()
    statsdClient.gauge('heap-used', heapUsed, { service: 'coordinator' })
    statsdClient.gauge('heap-total', heapTotal, { service: 'coordinator' })

  console.log('heapUsed', Math.trunc(heapUsed / (1024*1024)), 'heapTotal', Math.trunc(heapTotal / (1024 * 1024)))
}, 1_000)

app.listen(3000)
