const {Docker} = require('node-docker-api')
const Statsd = require('statsd-client')

const docker = new Docker({ socketPath: '/var/run/docker.sock' })
const statsdClient = new Statsd({ host: 'graphite-statsd' })

// List
docker.container.list()
   // Inspect
  .then(containers => containers[0].status())
  .then(container => container.stats())
  .then(stats => {
    stats.on('data', buffer => {
      const stat = JSON.parse(buffer)

      if (stat.name !== '/coordinator') {
        return
      }

      console.log('Memory usage', stat.memory_stats.usage)
      statsdClient.gauge('memory', stat.memory_stats.usage)
    })
    stats.on('error', err => console.log('Error: ', err))
  })
  .catch(error => console.log(error))
