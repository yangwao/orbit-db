'use strict'

const assert = require('assert')
const mapSeries = require('p-each-series')
const rmrf = require('rimraf')
const OrbitDB = require('../src/OrbitDB')
const config = require('./config')
const startIpfs = require('./start-ipfs')
const waitForPeers = require('./wait-for-peers')

const dbPath1 = './orbitdb/tests/replication/daemon1'
const dbPath2 = './orbitdb/tests/replication/daemon2'
const ipfsPath1 = './orbitdb/tests/replication/daemon1/ipfs'
const ipfsPath2 = './orbitdb/tests/replication/daemon2/ipfs'

describe('orbit-db - Replication', function() {
  this.timeout(config.timeout)

  let ipfs1, ipfs2, orbitdb1, orbitdb2, db1, db2

  before(async () => {
    config.daemon1.repo = ipfsPath1
    config.daemon2.repo = ipfsPath2
    rmrf.sync(config.daemon1.repo)
    rmrf.sync(config.daemon2.repo)
    rmrf.sync(dbPath1)
    rmrf.sync(dbPath2)
    ipfs1 = await startIpfs(config.daemon1)
    ipfs2 = await startIpfs(config.daemon2)
    orbitdb1 = new OrbitDB(ipfs1, dbPath1)
    orbitdb2 = new OrbitDB(ipfs2, dbPath2)
  })

  after(() => {
    if(orbitdb1) 
      orbitdb1.disconnect()

    if(orbitdb2) 
      orbitdb2.disconnect()

    if (ipfs1)
      ipfs1.stop()

    if (ipfs2)
      ipfs2.stop()
  })

  describe('two peers', function() {
    beforeEach(async (done) => {
      const options = { 
        // Set write access for both clients
        write: [
          orbitdb1.key.getPublic('hex'), 
          orbitdb2.key.getPublic('hex')
        ],
      }

      try {
        db1 = await orbitdb1.create('replication tests', 'eventlog', dbPath1, options)
        // Set 'sync' flag on. It'll prevent creating a new local database and rather
        // fetch the database from the network
        db2 = await orbitdb2.eventlog(db1.address, { sync: true })
        await waitForPeers(ipfs1, [orbitdb2.id], db1.address)
        await waitForPeers(ipfs2, [orbitdb1.id], db1.address)
        done()
      } catch (e) {
        done(e)
      }
    })

    afterEach(async () => {
      await db1.drop()
      await db2.drop()
    })

    it('replicates database of 1 entry', async (done) => {
      try {
        db2.events.on('replicated', () => {
          const items = db2.iterator().collect()
          assert.equal(items.length, 1)
          assert.equal(items[0].payload.value, 'hello')
          done()
        })
        await db1.add('hello')
      } catch (e) {
        done(e)
      }
    })

    it('replicates database of 100 entries', async (done) => {
      const entryCount = 100
      const entryArr = []
      let timer

      for (let i = 0; i < entryCount; i ++)
        entryArr.push(i)

      let count = 0
      try {
        db2.events.on('replicated', () => {
          if (count === entryCount && !timer) {
            timer = setInterval(() => {
              const items = db2.iterator({ limit: -1 }).collect()
              if (items.length === count) {
                clearInterval(timer)
                assert.equal(items.length, entryCount)
                assert.equal(items[0].payload.value, 'hello0')
                assert.equal(items[items.length - 1].payload.value, 'hello99')
                done()
              }
            }, 1000)
          }
        })
        db1.events.on('write', () => count++)
        await mapSeries(entryArr, (i) => db1.add('hello' + i))
      } catch (e) {
        done(e)
      }
    })
  })
})
