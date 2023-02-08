import {Docker} from 'node-docker-api'
import Statsd from 'hot-shots'

const docker = new Docker({ socketPath: '/var/run/docker.sock' })
const statsdClient = new Statsd({ host: 'telegraf', port: 8125, prefix: 'techtalk.', telegraf:true, errorHandler: (e) => console.log(e), protocol: 'udp'})

async function main () {
  const containerList = await docker.container.list()
  const monitoredContainers = containerList.filter((c) => {
    return c.data.Names.includes('/coordinator') || c.data.Names.includes('/orders')
  })

  for (const container of monitoredContainers) {
    const containerName = container.data.Names[0].replace('/','')
    const status = await container.status()
    const stats = await status.stats()

    stats.on('data', buffer => {
      const stat = JSON.parse(buffer)

      // console.log('Memory usage', stat.memory_stats.usage, { service: containerName })
      statsdClient.gauge('memory', stat.memory_stats.usage, { service: containerName })
    })
    stats.on('error', err => console.log('Error: ', err))
  }
}

main()
