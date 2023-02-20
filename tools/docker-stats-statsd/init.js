import {Docker} from 'node-docker-api'
import Statsd from 'hot-shots'

const docker = new Docker({ socketPath: '/var/run/docker.sock' })
const statsdClient = new Statsd({ host: 'telegraf', port: 8125, prefix: 'techtalk.', telegraf:true, errorHandler: (e) => console.log(e), protocol: 'udp'})

async function main () {
  const getContainerName = (container) => container.data.Names[0].replace('/', '')
  const getContainerId = (container) => container.data.Id
  const containersByName = {}

  // setInterval(async () => {
    const containerList = await docker.container.list()
    const runningContainers = containerList.filter((c) => {
      return c.data.Names.includes('/coordinator') || c.data.Names.includes('/orders')
    })

    // runningContainers.forEach((container) => {
    //   const containerName = getContainerName(container)
    //   const containerId = getContainerId(container)

    //   // Clear mapping for containers that don't exist anymore
    //   if (containersByName[containerName] !== undefined) {
    //     if (containersByName[containerName].id !== containerId) {
    //       delete containersByName[containerName]
    //     }
    //   }
    // })

    // const containersToMonitor = runningContainers.filter((container) => {
    //   const containerName = getContainerName(container)

    //   return containerName[container.Data.Names] === undefined
    // })

    for (const container of runningContainers) {
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

  // }, 10_000)

}

main()
