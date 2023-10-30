import Statsd from "hot-shots";
import Koa from "koa";
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
async function readConfig() {
  return JSON.parse(await fs.promises.readFile(process.env.CONFIG_FILE_PATH));
}
const SERVICE_NAME = process.env.SERVICE_NAME;

app.use(async (ctx, next) => {
  concurrency += 1;
  statsdClient.increment("requests", 1, { service: SERVICE_NAME });
  statsdClient.gauge("concurrency", concurrency, { service: SERVICE_NAME });

  const start = process.hrtime.bigint();

  await next();

  const end = process.hrtime.bigint();
  const latency = (end - start) / 1000_000n;

  concurrency -= 1;
  statsdClient.gauge("concurrency", concurrency, { service: SERVICE_NAME });
  statsdClient.timing("duration", latency, { service: SERVICE_NAME });
  statsdClient.increment("status_code", {
    service: SERVICE_NAME,
    status: ctx.status,
  });
});

// response
//
// fs.watchFile()
//
console.log("CONFIG_FILE_PATH", process.env.CONFIG_FILE_PATH);
fs.watchFile(process.env.CONFIG_FILE_PATH, async () => {
  console.log(
    `[${new Date().toISOString()}] ${process.env.CONFIG_FILE_PATH} file saved`
  );
  const { [SERVICE_NAME]: newConfig } = await readConfig();
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

app.use(async (ctx) => {
  try {
    const { overload, fail } = ctx.request.query;

    // if (ctx.settings.config.backpressureAt != -1 && concurrency >= ctx.settings.config.backpressureAt) {
    //   ctx.status = 599

    //   return
    // }

    if (fail === "true") {
      ctx.status = 500;
      return;
    }

    const val = Math.random() * 100;

    if (val < ctx.settings.config.percentageOfSlowedDownRequests) {
      await new Promise((resolve) =>
        setTimeout(resolve, ctx.settings.config.baseLatency)
      ); // hang for 1 hours
      // console.log('>>>', val, concurrency)
      await new Promise((resolve) =>
        setTimeout(resolve, ctx.settings.config.slowedDownRequestLatency)
      ); // hang for 1 hours
      ctx.body = "HELLO";
      return;
    }
    const timeoutLimit = Number(
      ctx.request.headers["x-timeout-limit"] ?? 10_000
    );

    // const totalLatency = Math.min(60 * 60 * 1000, ctx.settings.config.baseLatency * concurrencyPenalty)
    if (ctx.settings.config.useNewFeature === true) {
      const MAX_EXECUTION_TIME = 10_000; // 10s
      const concurrencyPenalty = concurrency ** 2 / 20;
      const totalLatency = ctx.settings.config.baseLatency * concurrencyPenalty;

      await new Promise((resolve, reject) => {
        setTimeout(reject, MAX_EXECUTION_TIME);
        setTimeout(resolve, totalLatency);
      });

      ctx.status = 200;

      return;
    }

    ctx.body = "Hello World";
  } catch (_e) {
    ctx.status = 500;
  }
});

async function main() {
  const { [SERVICE_NAME]: config } = await readConfig();

  app.context.settings = { config };
  app.listen(3000);
}

main();
