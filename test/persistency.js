'use strict'

const assert = require('assert')
const mapSeries = require('p-map-series')
const rmrf = require('rimraf')
const OrbitDB = require('../src/OrbitDB')
const config = require('./config')
const startIpfs = require('./start-ipfs')

const dbPath = './orbitdb/tests/persistency'
const ipfsPath = './orbitdb/tests/persistency/ipfs'

describe('orbit-db - Persistency', function() {
  this.timeout(config.timeout)

  let ipfs, orbitdb1

  before(async () => {
    config.daemon1.repo = ipfsPath
    rmrf.sync(config.daemon1.repo)
    rmrf.sync(dbPath)
    ipfs = await startIpfs(config.daemon1)
    orbitdb1 = new OrbitDB(ipfs, dbPath + '/1')
  })

  after(() => {
    if(orbitdb1) 
      orbitdb1.disconnect()

    ipfs.stop()
  })

  describe('load', function() {
    it('loads database from local cache', async (done) => {
      const dbName = new Date().getTime().toString()
      const entryCount = 100
      const entryArr = []

      for (let i = 0; i < entryCount; i ++)
        entryArr.push(i)

      const options = {
        path: dbPath,
      }

      let db, address

      try {
        db = await orbitdb1.eventlog(dbName)
        address = db.address
        await mapSeries(entryArr, (i) => db.add('hello' + i))
        await db.close()
        db = null

        db = await orbitdb1.eventlog(address)

        await db.load()
      } catch(e) {
        done(e)
      }
      const items = db.iterator({ limit: -1 }).collect()
      assert.equal(items.length, entryCount)
      assert.equal(items[0].payload.value, 'hello0')
      assert.equal(items[entryCount - 1].payload.value, 'hello99')
      done()
    })

    it('loading a database emits \'ready\' event', async (done) => {
      const dbName = new Date().getTime().toString()
      const entryCount = 100
      const entryArr = []

      for (let i = 0; i < entryCount; i ++)
        entryArr.push(i)

      const options = {
        path: dbPath,
      }

      let db, address

      try {
        db = await orbitdb1.eventlog(dbName)
        address = db.address

        await mapSeries(entryArr, (i) => db.add('hello' + i))
        await db.close()

        db = null
        db = await orbitdb1.eventlog(address)

        db.events.on('ready', () => {
          try {
            const items = db.iterator({ limit: -1 }).collect()
            assert.equal(items.length, entryCount)
            assert.equal(items[0].payload.value, 'hello0')
            assert.equal(items[entryCount - 1].payload.value, 'hello99')
            done()
          } catch(e) {
            console.log(e)
            done(e)
          }
        })

        await db.load()

      } catch(e) {
        done(e)
      }
    })
  })

  describe('load from snapshot', function() {
    it.skip('loads database from snapshot', async (done) => {
    })
  })
})
