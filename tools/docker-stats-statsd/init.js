const {Docker} = require('node-docker-api')
const Statsd = require('statsd-client')

const docker = new Docker({ socketPath: '/var/run/docker.sock' })
const statsdClient = new Statsd({ host: 'graphite-statsd' })

async function main () {
  const containerList = await docker.container.list()
  const monitoredContainers = containerList.filter((c) => {
    return c.data.Names.includes('/coordinator')
  })

  for (const container of monitoredContainers) {
    const status = await container.status()
    const stats = await status.stats()

    stats.on('data', buffer => {
      const stat = JSON.parse(buffer)

      console.log('Memory usage', stat.memory_stats.usage)
      statsdClient.gauge('memory', stat.memory_stats.usage)
    })
    stats.on('error', err => console.log('Error: ', err))
  }
}

main()
