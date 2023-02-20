import Statsd from 'hot-shots'
import Koa from 'koa'
import got  from 'got'

const app = new Koa()
const statsdClient = new Statsd({ host: 'telegraf', port: 8125, prefix: 'techtalk.', telegraf:true, errorHandler: (e) => console.log(e), protocol: 'udp'})

let concurrency = 0
const SERVICE_NAME = 'coordinator'

function loadBalance () {
  const hosts = ['http://orders:3000', 'http://orders-2:3000?overload=true']
  const index = Math.trunc(Math.random() * 2)

  return hosts[index === 2 ? 1 : index]
}

class Deferred {
  constructor(resolved = false) {
    this.promise = new Promise((resolve) => this.resolver = resolve)

    if (resolved) {
      this.resolve()
    }
  }

  resolve(value) {
    this.resolver(value)
  }
}

// class Lease {
//   constructor (store) {
//     this.store = store
//   }

//   restore() {
//     this.store.restore()
//   }
// }

class ClientLease {
  constructor(maxClients) {
    this.maxClients = maxClients
    this.checkedout = 0
    this.pending = []
  }

  checkout() {
    if (this.checkedout === this.maxClients) {
      const deferred = new Deferred()
      this.pending.push(deferred)

      return deferred
    } else {
      this.checkedout += 1
      return new Deferred(true)
    }
  }

  restore() {
    this.checkedout -= 1

    if (this.pending.length > 0) {
      this.checkedout += 1
      const deferred = this.pending.shift()
      deferred.resolve()
    }
  }
}

const CLIENT_LEASE = new ClientLease(50)

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
  // ctx.state = {
  //   gibberish: allocateArray(1024 * 1024)
  // }

  await next()
})

app.use(async (_ctx, next) => {
  concurrency += 1
  statsdClient.increment('requests', 1, { service: 'coordinator' })
  statsdClient.gauge('concurrency', concurrency, { service: 'coordinator' })

  const start = process.hrtime.bigint()

  await next()

  const end = process.hrtime.bigint()
  const latency = (end - start)/1000_000n

  concurrency -= 1

  statsdClient.gauge('concurrency', concurrency, { service: 'coordinator' })
  statsdClient.timing('duration', latency, { service: SERVICE_NAME })
})

// response

app.use(async ctx => {
  let lease
  try {
    lease = ctx.clientLease.checkout()
    await lease.promise

    // await got.get(loadBalance())
    await got.get(loadBalance(), { retry: { limit: 2 }, timeout: { request: 500 } })

    // await got.get('http://orders:3000', { timeout: { request: 500 } })
  } catch (e) {
    if (e.code !== 'ETIMEDOUT') {
      console.log(e)
    } else {
      statsdClient.increment('timeouts', { service: 'coordinator' })
    }

    ctx.status = 500
  } finally {
    ctx.clientLease.restore()
  }
})

setInterval(() => {
  const {heapUsed, heapTotal} = process.memoryUsage()
    statsdClient.gauge('heap-used', heapUsed, { service: 'coordinator' })
    statsdClient.gauge('heap-total', heapTotal, { service: 'coordinator' })
    statsdClient.gauge('leased-clients', CLIENT_LEASE.checkedout, { service: 'coordinator' })

  console.log('heapUsed', Math.trunc(heapUsed / (1024*1024)), 'heapTotal', Math.trunc(heapTotal / (1024 * 1024)))
}, 1_000)

app.context.clientLease = CLIENT_LEASE

app.listen(3000)
