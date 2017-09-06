'use strict'

const assert = require('assert')
const mapSeries = require('p-map-series')
const rmrf = require('rimraf')
const hasIpfsApiWithPubsub = require('./test-utils').hasIpfsApiWithPubsub
const IPFS = require('ipfs')
const OrbitDB = require('../src/OrbitDB')
const config = require('./config')

const dbPath = './orbitdb/tests/persistency'
const ipfsPath = './orbitdb/tests/persistency/ipfs'

describe('orbit-db - Persistency', function() {
  this.timeout(config.timeout)

  let ipfs, client

  before(function (done) {
    config.daemon1.repo = ipfsPath
    rmrf.sync(dbPath)
    ipfs = new IPFS(config.daemon1)
    ipfs.on('error', done)
    ipfs.on('ready', () => {
      client = new OrbitDB(ipfs, 'A')
      assert.equal(hasIpfsApiWithPubsub(ipfs), true)
      done()
    })
  })

  after(() => {
    if (client)
      client.disconnect()

    ipfs.stop()
  })

  describe('load', function() {
    it('loads database from local cache', function(done) {
      const dbName = new Date().getTime().toString()
      const entryCount = 100
      const entryArr = []

      for (let i = 0; i < entryCount; i ++)
        entryArr.push(i)

      const options = {
        // replicate: false,
        // maxHistory: -1,
        path: dbPath,
      }

      let db = client.eventlog(dbName, options)

      db.events.on('error', done)
      db.load().then(function () {
        mapSeries(entryArr, (i) => db.add('hello' + i))
          .then(() => {
            client.close(dbName)
            return new Promise(resolve => setTimeout(() => resolve(), 1000))
          })
          .then(() => {
            db = null
            db = client.eventlog(dbName, options)
            db.events.on('error', done)
            db.events.on('ready', () => {
              try {
                const items = db.iterator({ limit: -1 }).collect()
                assert.equal(items.length, entryCount)
                assert.equal(items[0].payload.value, 'hello0')
                assert.equal(items[entryCount - 1].payload.value, 'hello99')                  
                done()
              } catch(e) {
                done(e)
              }
            })
            db.load()
              .catch(done)
          })
          .catch(done)
      }).catch(done)
    })
  })
})
