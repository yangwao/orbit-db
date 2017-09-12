'use strict'

const path = require('path')
const assert = require('assert')
const rmrf = require('rimraf')
const mapSeries = require('p-each-series')
const IPFS = require('ipfs')
const OrbitDB = require('../src/OrbitDB')
const config = require('./config')
const hasIpfsApiWithPubsub = require('./test-utils').hasIpfsApiWithPubsub

const dbPath1 = './orbitdb/tests/counters/daemon1'
const dbPath2 = './orbitdb/tests/counters/daemon2'
const ipfsPath1 = './orbitdb/tests/counters/daemon1/ipfs'
const ipfsPath2 = './orbitdb/tests/counters/daemon2/ipfs'

const waitForPeers = (ipfs, peersToWait, topic, callback) => {
  const i = setInterval(() => {
    ipfs.pubsub.peers(topic, (err, peers) => {
      if (err) {
        return callback(err)
      }

      const hasAllPeers = peersToWait.map((e) => peers.includes(e)).filter((e) => e === false).length === 0
      if (hasAllPeers) {
        clearInterval(i)
        callback(null)
      }
    })
  }, 1000)
}

describe('CounterStore', function() {
  this.timeout(config.timeout)

  let client1, client2
  let daemon1, daemon2

  before((done) => {
    config.daemon1.repo = ipfsPath1
    config.daemon2.repo = ipfsPath2
    rmrf.sync(dbPath1)
    rmrf.sync(dbPath2)
    daemon1 = new IPFS(config.daemon1)
    daemon1.on('ready', () => {
      assert.equal(hasIpfsApiWithPubsub(daemon1), true)
      daemon2 = new IPFS(config.daemon2)
      daemon2.on('ready', () => {
        assert.equal(hasIpfsApiWithPubsub(daemon2), true)
        done()
      })
    })
  })

  after(() => {
    if (client1)
      client1.disconnect()

    if (client2)
      client2.disconnect()

    if (daemon1)
      daemon1.stop()

    if (daemon2)
      daemon2.stop()
  })

  beforeEach(() => {
    client1 = new OrbitDB(daemon1)
    client2 = new OrbitDB(daemon2)
  })

  describe('counters', function() {
    it('increases a counter value', function(done) {
      const timeout = setTimeout(() => done(new Error('event was not fired')), 2000)
      const counter = client1.counter('counter test', { replicate: false, path: dbPath1 })
      mapSeries([13, 1], (f) => counter.inc(f))
        .then(() => {
          assert.equal(counter.value, 14)
          clearTimeout(timeout)
          counter.close()
          done()
        })
        .catch(done)
    })

    it('creates a new counter from cached data', function(done) {
      const timeout = setTimeout(() => done(new Error('event was not fired')), 2000)
      const counter = client1.counter('counter test', { replicate: false, path: dbPath1 })
      counter.events.on('ready', () => {
        assert.equal(counter.value, 14)
        clearTimeout(timeout)
        counter.close()
        done()
      })
      counter.load()
    })

    it('syncs counters', (done) => {
      const name = new Date().getTime().toString()
      const counter1 = client1.counter(name, { path: dbPath1 + '/d1' })
      const counter2 = client2.counter(counter1.path, { path: dbPath2 + '/d2' })
      const numbers = [[13, 10], [2, 5]]

      const increaseCounter = (counter, i) => mapSeries(numbers[i], (e) => counter.inc(e))

      waitForPeers(daemon1, [client2.id], counter1.path, (err, res) => {
        waitForPeers(daemon2, [client1.id], counter1.path, (err, res) => {
          mapSeries([counter1, counter2], increaseCounter)
            .then(() => {
              // wait for a while to make sure db's have been synced
              setTimeout(() => {
                assert.equal(counter1.value, 30)
                assert.equal(counter2.value, 30)
                done()
              }, 4000)
            })
            .catch(done)
        })
      })
    })
  })
})
