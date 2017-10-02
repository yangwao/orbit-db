'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const mapSeries = require('p-map-series')
const OrbitDB = require('../src/OrbitDB')
const first = require('./test-utils').first
const last = require('./test-utils').last
const config = require('./config')
const startIpfs = require('./start-ipfs')

const dbPath = './orbitdb/tests/feed'
const ipfsPath = './orbitdb/tests/feed/ipfs'

describe('orbit-db - Feed', function() {
  this.timeout(config.timeout)

  let ipfs, orbitdb1, orbitdb2, db

  before(async () => {
    config.daemon1.repo = ipfsPath
    rmrf.sync(config.daemon1.repo)
    rmrf.sync(dbPath)
    ipfs = await startIpfs(config.daemon1)
    orbitdb1 = new OrbitDB(ipfs, dbPath + '/1')
    orbitdb2 = new OrbitDB(ipfs, dbPath + '/2')
  })

  after(() => {
    if(orbitdb1) 
      orbitdb1.disconnect()

    if(orbitdb2) 
      orbitdb2.disconnect()

    ipfs.stop()
  })

  describe('Feed', function() {
    it('returns the added entry\'s hash, 1 entry', async () => {
      db = await orbitdb1.feed('first')
      const hash = await db.add('hello1')
      const items = db.iterator({ limit: -1 }).collect()
      assert.notEqual(hash, null)
      assert.equal(hash, last(items).hash)
      assert.equal(items.length, 1)
    })

    it('returns the added entry\'s hash, 2 entries', async () => {
      const prevHash = db.iterator().collect()[0].hash
      const hash = await db.add('hello2')
      const items = db.iterator({ limit: -1 }).collect()
      assert.equal(items.length, 2)
      assert.notEqual(hash, null)
      assert.notEqual(hash, prevHash)
      assert.equal(hash, last(items).hash)
    })

    it('adds five items', async () => {
      db = await orbitdb1.feed('second')
      await mapSeries([1, 2, 3, 4, 5], (i) => db.add('hello' + i))
      const items = db.iterator({ limit: -1 }).collect()
      assert.equal(items.length, 5)
      assert.equal(first(items.map((f) => f.payload.value)), 'hello1')
      assert.equal(last(items.map((f) => f.payload.value)), 'hello5')
    })

    it('adds an item that is > 256 bytes', async () => {
      db = await orbitdb1.feed('third')
      let msg = new Buffer(1024)
      msg.fill('a')
      const hash = await db.add(msg.toString())
      assert.notEqual(hash, null)
      assert.equal(hash.startsWith('Qm'), true)
      assert.equal(hash.length, 46)
    })

    it('deletes an item when only one item in the database', async () => {
      db = await orbitdb1.feed('fourth')
      const hash = await db.add('hello3')
      const delopHash = await db.remove(hash)
      const items = db.iterator().collect()
      assert.equal(delopHash.startsWith('Qm'), true)
      assert.equal(items.length, 0)
    })

    it('deletes an item when two items in the database', async () => {
      db = await orbitdb1.feed('fifth')

      await db.add('hello1')
      const hash = await db.add('hello2')
      await db.remove(hash)
      const items = db.iterator({ limit: -1 }).collect()
      assert.equal(items.length, 1)
      assert.equal(first(items).payload.value, 'hello1')
    })

    it('deletes an item between adds', async () => {
      db = await orbitdb1.feed('sixth')

      const hash = await db.add('hello1')
      await db.add('hello2')
      await db.remove(hash)
      await db.add('hello3')

      const items = db.iterator({ limit: -1 }).collect()
      assert.equal(items.length, 2)

      const firstItem = first(items)
      const secondItem = items[1]
      assert.equal(firstItem.hash.startsWith('Qm'), true)
      assert.equal(firstItem.payload.key, null)
      assert.equal(firstItem.payload.value, 'hello2')
      assert.equal(secondItem.payload.value, 'hello3')
    })
  })

  describe('Iterator', function() {
    let items = []
    const itemCount = 5

    before(async () => {
      items = []
      db = await orbitdb1.feed('feed-iterator')
      items = await mapSeries([0, 1, 2, 3, 4], (i) => db.add('hello' + i))
    })

    describe('Defaults', function() {
      it('returns an iterator', () => {
        const iter = db.iterator()
        const next = iter.next().value
        assert.notEqual(iter, null)
        assert.notEqual(next, null)
      })

      it('returns an item with the correct structure', () => {
        const iter = db.iterator()
        const next = iter.next().value
        assert.notEqual(next, null)
        assert.equal(next.hash.startsWith('Qm'), true)
        assert.equal(next.payload.key, null)
        assert.equal(next.payload.value, 'hello4')
      })

      it('implements Iterator interface', () => {
        const iter = db.iterator({ limit: -1 })
        let messages = []

        for(let i of iter)
          messages.push(i.key)

        assert.equal(messages.length, items.length)
      })

      it('returns 1 item as default', () => {
        const iter = db.iterator()
        const first = iter.next().value
        const second = iter.next().value
        assert.equal(first.hash, items[items.length - 1])
        assert.equal(second, null)
        assert.equal(first.payload.value, 'hello4')
      })

      it('returns items in the correct order', () => {
        const amount = 3
        const iter = db.iterator({ limit: amount })
        let i = items.length - amount
        for(let item of iter) {
          assert.equal(item.payload.value, 'hello' + i)
          i ++
        }
      })
    })

    describe('Collect', function() {
      it('returns all items', () => {
        const messages = db.iterator({ limit: -1 }).collect()
        assert.equal(messages.length, items.length)
        assert.equal(messages[0].payload.value, 'hello0')
        assert.equal(messages[messages.length - 1].payload.value, 'hello4')
      })

      it('returns 1 item', () => {
        const messages = db.iterator().collect()
        assert.equal(messages.length, 1)
      })

      it('returns 3 items', () => {
        const messages = db.iterator({ limit: 3 }).collect()
        assert.equal(messages.length, 3)
      })
    })

    describe('Options: limit', function() {
      it('returns 1 item when limit is 0', () => {
        const iter = db.iterator({ limit: 1 })
        const first = iter.next().value
        const second = iter.next().value
        assert.equal(first.hash, last(items))
        assert.equal(second, null)
      })

      it('returns 1 item when limit is 1', () => {
        const iter = db.iterator({ limit: 1 })
        const first = iter.next().value
        const second = iter.next().value
        assert.equal(first.hash, last(items))
        assert.equal(second, null)
      })

      it('returns 3 items', () => {
        const iter = db.iterator({ limit: 3 })
        const first = iter.next().value
        const second = iter.next().value
        const third = iter.next().value
        const fourth = iter.next().value
        assert.equal(first.hash, items[items.length - 3])
        assert.equal(second.hash, items[items.length - 2])
        assert.equal(third.hash, items[items.length - 1])
        assert.equal(fourth, null)
      })

      it('returns all items', () => {
        const messages = db.iterator({ limit: -1 })
          .collect()
          .map((e) => e.hash)

        messages.reverse()
        assert.equal(messages.length, items.length)
        assert.equal(messages[0], items[items.length - 1])
      })

      it('returns all items when limit is bigger than -1', () => {
        const messages = db.iterator({ limit: -300 })
          .collect()
          .map((e) => e.hash)

        assert.equal(messages.length, items.length)
        assert.equal(messages[0], items[0])
      })

      it('returns all items when limit is bigger than number of items', () => {
        const messages = db.iterator({ limit: 300 })
          .collect()
          .map((e) => e.hash)

        assert.equal(messages.length, items.length)
        assert.equal(messages[0], items[0])
      })
    })

    describe('Option: ranges', function() {
      describe('gt & gte', function() {
        it('returns 1 item when gte is the head', () => {
          const messages = db.iterator({ gte: last(items), limit: -1 })
            .collect()
            .map((e) => e.hash)

          assert.equal(messages.length, 1)
          assert.equal(messages[0], last(items))
        })

        it('returns 0 items when gt is the head', () => {
          const messages = db.iterator({ gt: last(items) }).collect()
          assert.equal(messages.length, 0)
        })

        it('returns 2 item when gte is defined', () => {
          const gte = items[items.length - 2]
          const messages = db.iterator({ gte: gte, limit: -1 })
            .collect()
            .map((e) => e.hash)

          assert.equal(messages.length, 2)
          assert.equal(messages[0], items[items.length - 2])
          assert.equal(messages[1], items[items.length - 1])
        })

        it('returns all items when gte is the root item', () => {
          const messages = db.iterator({ gte: items[0], limit: -1 })
            .collect()
            .map((e) => e.hash)

          assert.equal(messages.length, items.length)
          assert.equal(messages[0], items[0])
          assert.equal(messages[messages.length - 1], last(items))
        })

        it('returns items when gt is the root item', () => {
          const messages = db.iterator({ gt: items[0], limit: -1 })
            .collect()
            .map((e) => e.hash)

          assert.equal(messages.length, itemCount - 1)
          assert.equal(messages[0], items[1])
          assert.equal(messages[3], last(items))
        })

        it('returns items when gt is defined', () => {
          const messages = db.iterator({ limit: -1})
            .collect()
            .map((e) => e.hash)

          const gt = messages[2]

          const messages2 = db.iterator({ gt: gt, limit: 100 })
            .collect()
            .map((e) => e.hash)

          assert.equal(messages2.length, 2)
          assert.equal(messages2[0], messages[messages.length - 2])
          assert.equal(messages2[1], messages[messages.length - 1])
        })
      })

      describe('lt & lte', function() {
        it('returns one item after head when lt is the head', () => {
          const messages = db.iterator({ lt: last(items) })
            .collect()
            .map((e) => e.hash)

          assert.equal(messages.length, 1)
          assert.equal(messages[0], items[items.length - 2])
        })

        it('returns all items when lt is head and limit is -1', () => {
          const messages = db.iterator({ lt: last(items), limit: -1 })
            .collect()
            .map((e) => e.hash)

          assert.equal(messages.length, items.length - 1)
          assert.equal(messages[0], items[0])
          assert.equal(messages[messages.length - 1], items[items.length - 2])
        })

        it('returns 3 items when lt is head and limit is 3', () => {
          const messages = db.iterator({ lt: last(items), limit: 3 })
            .collect()
            .map((e) => e.hash)

          assert.equal(messages.length, 3)
          assert.equal(messages[0], items[items.length - 4])
          assert.equal(messages[2], items[items.length - 2])
        })

        it('returns null when lt is the root item', () => {
          const messages = db.iterator({ lt: items[0] }).collect()
          assert.equal(messages.length, 0)
        })

        it('returns one item when lte is the root item', () => {
          const messages = db.iterator({ lte: items[0] })
            .collect()
            .map((e) => e.hash)

          assert.equal(messages.length, 1)
          assert.equal(messages[0], items[0])
        })

        it('returns all items when lte is the head', () => {
          const messages = db.iterator({ lte: last(items), limit: -1 })
            .collect()
            .map((e) => e.hash)

          assert.equal(messages.length, itemCount)
          assert.equal(messages[0], items[0])
          assert.equal(messages[4], last(items))
        })

        it('returns 3 items when lte is the head', () => {
          const messages = db.iterator({ lte: last(items), limit: 3 })
            .collect()
            .map((e) => e.hash)

          assert.equal(messages.length, 3)
          assert.equal(messages[0], items[items.length - 3])
          assert.equal(messages[1], items[items.length - 2])
          assert.equal(messages[2], last(items))
        })
      })
    })
  })

  describe('sync', () => {
    it('syncs databases', async (done) => {
      const options = { 
        // Set write access for both clients
        write: [
          orbitdb1.key.getPublic('hex'), 
          orbitdb2.key.getPublic('hex')
        ],
      }

      const db1 = await orbitdb1.feed(config.dbname, options)
      const db2 = await orbitdb2.feed(db1.path, options)

      db1.events.on('error', (e) => {
        console.log(e.stack())
        done(e)
      })

      db2.events.on('write', (dbname, hash, entry, heads) => {
        assert.equal(db1.iterator({ limit: -1 }).collect().length, 0)
        db1.sync(heads)
      })

      db1.events.on('replicated', () => {
        const items = db1.iterator({ limit: -1 }).collect()
        assert.equal(items.length, 1)
        assert.equal(items[0].payload.value, 'hello2')
        done()
      })

      await db2.add('hello2')
    })

    it('doesn\'t sync if peer is not allowed to write to the database', async (done) => {
      let options = { 
        // No write access (only creator of the database can write)
        write: [],
      }

      options = Object.assign({}, options, { path: dbPath + '/sync-test/1' })
      const db1 = await orbitdb1.feed(config.dbname, options)

      options = Object.assign({}, options, { path: dbPath + '/sync-test/2' })
      const db2 = await orbitdb2.feed(db1.path, options)

      db1.events.on('error', (e) => {
        console.log(e)
        done(e)
      })

      db2.events.on('write', (dbname, hash, entry, heads) => {
        assert.equal(db1.iterator({ limit: -1 }).collect().length, 0)
        db1.sync(heads)
        setTimeout(() => {
          assert.equal(db1.iterator({ limit: -1 }).collect().length, 0)
          done()
        }, 500)
      })

      db1.events.on('replicated', () => {
        done(new Error('Shouldn\'t replicate!'))
      })

      await db2.add('hello2')
    })
  })
})
