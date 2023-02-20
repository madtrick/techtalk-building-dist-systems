import Statsd from 'hot-shots'
import Koa from 'koa'

const app = new Koa()
const statsdClient = new Statsd({ host: 'telegraf', port: 8125, prefix: 'techtalk.', telegraf:true, errorHandler: (e) => console.log(e), protocol: 'udp'})

let concurrency = 0
const SERVICE_NAME = process.env.SERVICE_NAME

app.use(async (_ctx, next) => {
  concurrency += 1
  statsdClient.increment('requests', 1, { service: SERVICE_NAME })
  statsdClient.gauge('concurrency', concurrency, { service: SERVICE_NAME })

  const start = process.hrtime.bigint()

  await next()

  const end = process.hrtime.bigint()
  const latency = (end - start)/1000_000n

  concurrency -= 1
  statsdClient.gauge('concurrency', concurrency, { service: SERVICE_NAME })
  statsdClient.timing('duration', latency, { service: SERVICE_NAME })
})

// response

app.use(async ctx => {
  const { overload } = ctx.request.query

  if (overload === 'true'){
    const baseLatency = Math.random() * 500
    const concurrencyPenalty = concurrency * 23
    const totalLatency = Math.min(5_000, baseLatency + concurrencyPenalty)

    await new Promise((resolve) => setTimeout(resolve, totalLatency))
  }

  ctx.body = 'Hello World'
})

app.listen(3000)
