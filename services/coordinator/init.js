const Statsd = require('statsd-client')
const crypto = require('crypto')
// const os = require('os');

console.log("Starting the coordinator...")

const statsdClient = new Statsd({ host: 'graphite-statsd' })

const values = []

setInterval(() => {

  // Simple way to fill in the memory allocated to the container
  values.push(crypto.randomBytes(1024 * 100))
  console.log(values.length)

  // console.log('Sending metric');
  statsdClient.increment('some.counter')
}, 1000)
