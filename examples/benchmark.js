'use strict'

const IPFS = require('ipfs')
const IPFSRepo = require('ipfs-repo')
const DatastoreLevel = require('datastore-level')
const OrbitDB = require('../src/OrbitDB')

// Metrics
let totalQueries = 0
let seconds = 0
let queriesPerSecond = 0
let lastTenSeconds = 0

// Main loop
const queryLoop = (db) => {
  const st = new Date().getTime()
  db.add(totalQueries)
    .then(() => {
      const et = new Date().getTime()
      // console.log(et - st + " ms")
      totalQueries ++
      lastTenSeconds ++
      queriesPerSecond ++
      setImmediate(() => queryLoop(db))
    })
    .catch((e) => console.error(e))
}

// Start
console.log("Starting IPFS daemon...")

const repoConf = {
  storageBackends: {
    blocks: DatastoreLevel,
  },  
}

const ipfs = new IPFS({
  repo: new IPFSRepo('./orbitdb/benchmarks/ipfs', repoConf),
  start: false,
})

ipfs.on('error', (err) => console.error(err))

ipfs.on('ready', () => {
  const orbit = new OrbitDB(ipfs, 'benchmark')
  const db = orbit.eventlog('orbit-db.benchmark', { 
    replicate: false,
    path: './orbitdb/benchmarks',
  })

  // Metrics output
  setInterval(() => {
    seconds ++
    if(seconds % 10 === 0) {
      console.log(`--> Average of ${lastTenSeconds/10} q/s in the last 10 seconds`)
      if(lastTenSeconds === 0)
        throw new Error("Problems!")
      lastTenSeconds = 0
    }
    console.log(`${queriesPerSecond} queries per second, ${totalQueries} queries in ${seconds} seconds (Oplog: ${db._oplog.length})`)
    queriesPerSecond = 0
  }, 1000)

  // Start the main loop
  queryLoop(db)
})
