import Statsd from 'hot-shots'
import Koa from 'koa'

const app = new Koa()
const statsdClient = new Statsd({ host: 'telegraf', port: 8125, prefix: 'techtalk.', telegraf:true, errorHandler: (e) => console.log(e), protocol: 'udp'})

let concurrency = 0

app.use(async (_ctx, next) => {
  concurrency += 1
  statsdClient.increment('requests', 1, { service: 'orders' })
  statsdClient.gauge('concurrency', concurrency, { service: 'orders' })

  const start = process.hrtime.bigint()

  await next()

  const end = process.hrtime.bigint()
  const latency = (end - start)/1000_000n

  concurrency -= 1
  statsdClient.gauge('concurrency', concurrency, { service: 'orders' })
  statsdClient.timing('duration', latency, { service: 'orders' })
})

// response

app.use(async ctx => {
  const baseLatency = Math.random() * 500
  const concurrencyPenalty = concurrency * 23

  await new Promise((resolve) => setTimeout(resolve, baseLatency + concurrencyPenalty))
  ctx.body = 'Hello World'
})

app.listen(3000)
