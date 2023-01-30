const Statsd = require('statsd-client')

console.log("Starting the coordinator...")

const statsdClient = new Statsd({ host: 'graphite-statsd' })

setInterval(() => {
  console.log('Sending metric');
  statsdClient.increment('some.counter')
}, 1000)
