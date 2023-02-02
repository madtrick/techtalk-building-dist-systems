import Statsd from 'statsd-client'
import Koa from 'koa'
import got from 'got'

const app = new Koa()
const statsdClient = new Statsd({ host: 'graphite-statsd' })

let concurrency = 0

app.use(async (_ctx, next) => {
  concurrency += 1
  statsdClient.increment('requests', { service: 'coordinator' })
  statsdClient.gauge('concurrency', concurrency, { service: 'coordinator' })
  await next()
  concurrency -= 1
  statsdClient.gauge('concurrency', concurrency, { service: 'coordinator' })
})

// response

app.use(async ctx => {
  console.log('Concurrency', concurrency)
  await got.get('http://orders:3000')
  // await new Promise((resolve) => setTimeout(resolve, 1000))
  ctx.body = 'Hello World'
})

app.listen(3000)
