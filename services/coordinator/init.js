import Statsd from "hot-shots";
import Koa from "koa";
import got from "got";
import fs from "fs";
import diff from "json-diff";

const app = new Koa();
const statsdClient = new Statsd({
  host: "telegraf",
  port: 8125,
  prefix: "conference.",
  telegraf: true,
  errorHandler: (e) => console.log(e),
  protocol: "udp",
});

let concurrency = 0;
let requests = 0;
const SERVICE_NAME = "coordinator";
async function readConfig() {
  const data = await fs.promises.readFile(process.env.CONFIG_FILE_PATH);
  return JSON.parse(data.toString());
}

function loadBalance() {
  const hosts = ["http://orders:3000", "http://orders-2:3000?overload=true"];
  const index = Math.trunc(Math.random() * 2);

  return hosts[index === 2 ? 1 : index];
}

class ClientLease {
  constructor(maxClients) {
    this.maxClients = maxClients;
    this.checkedout = 0;
    this.pending = [];
  }

  checkout(throws) {
    let rejectFn;
    let resolveFn;
    const promise = new Promise((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });

    const timeout = setTimeout(() => {
      rejectFn("BOOM");
    }, 100);

    const start = process.hrtime.bigint();

    promise
      .then(() => {
        const end = process.hrtime.bigint();
        const latency = (end - start) / 1000_000n;

        statsdClient.timing("checkout", latency, { service: SERVICE_NAME });
      })
      .catch(() => {});

    if (this.checkedout >= this.maxClients) {
      if (throws) {
        throw new Error("POOL EMPTY");
      }

      this.pending.push({ resolve: resolveFn, reject: rejectFn, timeout });

      return promise;
    } else {
      this.checkedout += 1;
      resolveFn();
      return promise;
    }
  }

  restore() {
    this.checkedout -= 1;

    if (this.pending.length > 0) {
      this.checkedout += 1;
      const { resolve, timeout } = this.pending.shift();
      resolve();
      clearTimeout(timeout);
    }
  }
}

const CLIENT_LEASE = new ClientLease(500);
// const GIBBERISH = Array(1024*100).fill('A')

// function allocateArray(size) {
//   /**
//    * This function exists because I needed a way to create data in the heap.
//    * Using `crypto.randomBytes` allocates them in the `externalMemory`.
//    */
//   const array = new Array(size)
//   array.forEach((e, index) => array[index] = 'A')

//   return array
// }

// app.use(async (ctx, next) => {
//   ctx.state = {
//     // gibberish: allocateArray(1024 * 100)
//     // gibberish: 'a'
//     // gibberish: GIBBERISH.slice(0)
//   }

//   await next()
// })

async function trackTiming(fn, callback) {
  const start = process.hrtime.bigint();

  const result = await fn();

  const end = process.hrtime.bigint();
  const latency = (end - start) / 1000_000n;

  callback(latency);

  return result;
}

app.use(async (ctx, next) => {
  concurrency += 1;
  requests += 1;
  statsdClient.increment("requests", 1, { service: "coordinator" });
  statsdClient.gauge("concurrency", concurrency, { service: "coordinator" });

  const start = process.hrtime.bigint();

  await next();

  const end = process.hrtime.bigint();
  const latency = (end - start) / 1000_000n;

  concurrency -= 1;

  statsdClient.gauge("concurrency", concurrency, { service: "coordinator" });
  statsdClient.timing("duration", latency, { service: SERVICE_NAME });

  if (latency <= 200) {
    statsdClient.increment("duration_lte_200", { service: SERVICE_NAME });
    // } else if (latency > 200 && latency < 500) {
    //   statsdClient.increment('duration_200_500', { service: SERVICE_NAME })
    // } else if (latency > 500 && latency < 1000) {
    //   statsdClient.increment('duration_500_1000', { service: SERVICE_NAME })
    // } else if (latency > 1000 && latency < 2000) {
    //   statsdClient.increment('duration_1000_2000', { service: SERVICE_NAME })
  } else {
    statsdClient.increment("duration_gt_200", { service: SERVICE_NAME });
  }

  statsdClient.increment("status_code", {
    service: "coordinator",
    status: ctx.status,
  });
});

// response

app.use(async (ctx) => {
  let lease;
  try {
    lease = ctx.clientLease.checkout();
    await lease;

    const gotOptions = {
      throwHttpErrors: false,
      retry: { limit: 0 },
      headers: {},
      searchParams: {
        fail: false,
        overload: false,
      },
    };

    if (ctx.settings.config.requestDeadline != -1) {
      gotOptions.headers["X-Timeout-Limit"] =
        ctx.settings.config.requestDeadline;
    }

    if (ctx.settings.config.timeout !== -1) {
      gotOptions.timeout = { request: ctx.settings.config.timeout };
    }

    if (ctx.settings.config.retries.limit > 0) {
      gotOptions.retry = {
        calculateDelay: ({ attemptCount, computedValue }) => {
          if (attemptCount > ctx.settings.config.retries.limit) {
            return 0;
          }
          statsdClient.increment("retries", { service: SERVICE_NAME });

          return computedValue;
          // console.log(attemptCount)
          /*
           * jitter = 100
           * 1 -> 200
           * 2 -> 400
           * 3 -> 800
           *
           * jitter = 50
           * 1 -> 100
           * 2 -> 200
           * 3 -> 400
           */
          // const delay = Math.min((2**attemptCount) * 1_000 + Math.random() * 100, 1_00_000)
          // // console.log('delay', delay)
          // return delay
        },
      };
    } else {
      gotOptions.retry = { limit: ctx.settings.config.retries.limit };
    }

    const response = await trackTiming(
      async () => {
        return got.get("http://orders:3000", gotOptions);
      },
      (latency) => {
        statsdClient.timing("latency-orders", latency, {
          service: SERVICE_NAME,
        });
      }
    );

    ctx.status = response.statusCode;
  } catch (e) {
    if (e && e.code === "ETIMEDOUT") {
      statsdClient.increment("timeouts", { service: "coordinator" });
    } else {
      console.log("ERROR", e);
    }

    ctx.status = 500;
  } finally {
    ctx.clientLease.restore();
  }
});

process.on("unhandledRejection", (reason, p) => {
  console.log(reason, p);
  // console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
  // application specific logging, throwing an error, or other logic here
});

setInterval(() => {
  const { heapUsed, heapTotal } = process.memoryUsage();
  statsdClient.gauge("heap-used", heapUsed, { service: "coordinator" });
  statsdClient.gauge("heap-total", heapTotal, { service: "coordinator" });
  statsdClient.gauge("leased-clients", CLIENT_LEASE.checkedout, {
    service: "coordinator",
  });

  requests = 0;
  // console.log('heapUsed', Math.trunc(heapUsed / (1024*1024)), 'heapTotal', Math.trunc(heapTotal / (1024 * 1024)))
}, 1_000);

app.context.clientLease = CLIENT_LEASE;

fs.watchFile(process.env.CONFIG_FILE_PATH, async () => {
  console.log(
    `[${new Date().toISOString()}] ${process.env.CONFIG_FILE_PATH} file saved`
  );
  const { coordinator: newConfig } = await readConfig();
  const diffValue = diff.diffString(app.context.settings.config, newConfig);

  if (diffValue.length === 0) {
    console.log(
      `[${new Date().toISOString()}] ${process.env.CONFIG_FILE_PATH} no changes`
    );
    return;
  }

  console.log(diffValue);
  app.context.settings.config = newConfig;
});

async function main() {
  const { coordinator: config } = await readConfig();

  app.context.settings = { config };
  app.listen(3000);
}

main();
