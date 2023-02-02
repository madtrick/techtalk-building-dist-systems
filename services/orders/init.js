const Statsd = require('statsd-client')
const Koa = require('koa')

const app = new Koa()
const statsdClient = new Statsd({ host: 'graphite-statsd' })

let concurrency = 0

app.use(async (_ctx, next) => {
  concurrency += 1
  statsdClient.increment('requests', { service: 'orders' })
  statsdClient.gauge('concurrency', concurrency, { service: 'orders' })
  await next()
  concurrency -= 1
  statsdClient.gauge('concurrency', concurrency, { service: 'orders' })
})

// response

app.use(async ctx => {
  console.log('Concurrency', concurrency)
  await new Promise((resolve) => setTimeout(resolve, 1_000_000))
  ctx.body = 'Hello World'
})

app.listen(3000)
