import Statsd from 'hot-shots'
import Koa from 'koa'

const app = new Koa()
const statsdClient = new Statsd({ host: 'telegraf', port: 8125, prefix: 'techtalk.', telegraf:true, errorHandler: (e) => console.log(e), protocol: 'udp'})

let concurrency = 0

app.use(async (_ctx, next) => {
  concurrency += 1
  statsdClient.increment('requests', 1, { service: 'orders' })
  statsdClient.gauge('concurrency', concurrency, { service: 'orders' })

  await next()

  concurrency -= 1
  statsdClient.gauge('concurrency', concurrency, { service: 'orders' })
})

// response

app.use(async ctx => {
  await new Promise((resolve) => setTimeout(resolve, 60_000))
  ctx.body = 'Hello World'
})

app.listen(3000)
