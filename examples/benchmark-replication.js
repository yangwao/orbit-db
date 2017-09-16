'use strict'

const IPFS = require('ipfs')
const IPFSRepo = require('ipfs-repo')
const DatastoreLevel = require('datastore-level')
const OrbitDB = require('../src/OrbitDB')
const startIpfs = require('../test/start-ipfs')
const pMapSeries = require('p-map-series')

const conf = {
  Addresses: {
    API: '/ip4/127.0.0.1/tcp/0',
    Swarm: ['/ip4/0.0.0.0/tcp/0'],
    Gateway: '/ip4/0.0.0.0/tcp/0'
  },
  Bootstrap: [],
  Discovery: {
    MDNS: {
      Enabled: true,
      Interval: 10
    },
    webRTCStar: {
      Enabled: false
    }
  },
}

// Metrics
let metrics1 = {
  totalQueries: 0,
  seconds: 0,
  queriesPerSecond: 0,
  lastTenSeconds: 0,
}

let metrics2 = {
  totalQueries: 0,
  seconds: 0,
  queriesPerSecond: 0,
  lastTenSeconds: 0,
}

// Write loop
const queryLoop = (db) => {
  if (metrics1.totalQueries < updateCount) {
    db.add(metrics1.totalQueries)
      .then(() => {
        metrics1.totalQueries ++
        metrics1.lastTenSeconds ++
        metrics1.queriesPerSecond ++
        setImmediate(() => queryLoop(db))
      })
      .catch((e) => console.error(e))
  }
}

const waitForPeers = (ipfs, channel) => {
  return new Promise((resolve, reject) => {
    console.log(`Waiting for peers on ${channel}...`)
    const interval = setInterval(() => {
      ipfs.pubsub.peers(channel)
        .then((peers) => {
          if (peers.length > 0) {
            console.log("Found peers, running tests...")
            clearInterval(interval)
            resolve()
          }
        })
        .catch((e) => {
          clearInterval(interval)
          reject(e)
        })
    }, 1000)
  })
}

// Start
console.log("Starting IPFS daemons...")

const repoConf = {
  storageBackends: {
    blocks: DatastoreLevel,
  },
}

const conf1 = {
  repo: new IPFSRepo('./orbitdb/benchmark-replication-1/ipfs', repoConf),
  start: true,
  EXPERIMENTAL: {
    pubsub: true,
    sharding: false,
    dht: false,
  },
  config: conf
}

const conf2 = {
  repo: new IPFSRepo('./orbitdb/benchmark-replication-2/ipfs', repoConf),
  start: true,
  EXPERIMENTAL: {
    pubsub: true,
    sharding: false,
    dht: false,
  },
  config: conf
}

const database = '/orbitdb/QmQoVv2c196B5hhQtgThwRZgpWDq48NNu9Qcg9WniU4mb1/benchmark-replication'
const updateCount = 2000

pMapSeries([conf1, conf2], d => startIpfs(d))
  .then(([ipfs1, ipfs2]) => {
    const orbit1 = new OrbitDB(ipfs1)
    const db1 = orbit1.eventlog(database, { 
      path: './orbitdb/benchmarks1',
      replicate: true,
    })

    const orbit2 = new OrbitDB(ipfs2)
    const db2 = orbit2.eventlog(database, { 
      path: './orbitdb/benchmarks2',
      replicate: true,
    })

    // Wait for peers to connect and start the write loop
    waitForPeers(ipfs1, db1.path)
      .then(() => {
        queryLoop(db1)

        // Metrics output
        const writeInterval = setInterval(() => {
          metrics1.seconds ++
          console.log(`[WRITE] ${metrics1.queriesPerSecond} queries per second, ${metrics1.totalQueries} queries in ${metrics1.seconds} seconds (Oplog: ${db1._oplog.length})`)
          metrics1.queriesPerSecond = 0

          if(metrics1.seconds % 10 === 0) {
            console.log(`[WRITE] --> Average of ${metrics1.lastTenSeconds/10} q/s in the last 10 seconds`)
            metrics1.lastTenSeconds = 0
          }

          if (metrics1.totalQueries === updateCount) {
            clearInterval(writeInterval)
          }
        }, 1000)
      })

    // Wait for peers and start the read loop
    let prevCount = 0
    waitForPeers(ipfs2, db2.path)
      .then(() => {
        // Metrics output
        setInterval(() => {
          metrics2.seconds ++

          const result = db2.iterator({ limit: -1 }).collect()
          metrics2.totalQueries = result.length
          metrics2.queriesPerSecond = metrics2.totalQueries - prevCount
          metrics2.lastTenSeconds += metrics2.queriesPerSecond
          prevCount = metrics2.totalQueries

          console.log(`[READ ] ${metrics2.queriesPerSecond} queries per second, ${metrics2.totalQueries} queries in ${metrics2.seconds} seconds (Oplog: ${db2._oplog.length})`)
          metrics2.queriesPerSecond = 0

          if(metrics2.seconds % 10 === 0) {
            console.log(`[READ ] --> Average of ${metrics2.lastTenSeconds/10} q/s in the last 10 seconds`)
            metrics2.lastTenSeconds = 0
          }

          if (metrics1.totalQueries === db2._oplog.length) {
            console.log("Finished")
            process.exit(0)
          }
        }, 1000)
      })
  })
