import Statsd from 'hot-shots'
import Koa from 'koa'
import got from 'got'
import crypto from 'crypto'

const app = new Koa()
const statsdClient = new Statsd({ host: 'telegraf', port: 8125, prefix: 'techtalk.', telegraf:true, errorHandler: (e) => console.log(e), protocol: 'udp'})

let concurrency = 0

app.use(async (_ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.log(err)
    return 'ERROR'
  }
})

app.use(async (ctx, next) => {
  ctx.state = {
    gibberish: crypto.randomBytes(1_000_000)
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

  ctx.body = 'Hello World'
})

app.listen(3000)
