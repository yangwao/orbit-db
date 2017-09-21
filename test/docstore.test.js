'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const OrbitDB = require('../src/OrbitDB')
const config = require('./config')
const startIpfs = require('./start-ipfs')

const dbPath = './orbitdb/tests/docstore'
const ipfsPath = './orbitdb/tests/docstore/ipfs'

describe('orbit-db - Document Store', function() {
  this.timeout(config.timeout)

  let ipfs, orbitdb1, orbitdb2, db

  before(async () => {
    config.daemon1.repo = ipfsPath
    rmrf.sync(config.daemon1.repo)
    ipfs = await startIpfs(config.daemon1)
    orbitdb1 = new OrbitDB(ipfs, dbPath + '/1')
    orbitdb2 = new OrbitDB(ipfs, dbPath + '/2')
  })

  after(() => {
    if(orbitdb1) 
      orbitdb1.disconnect()

    if(orbitdb2) 
      orbitdb2.disconnect()

    if (ipfs) 
      ipfs.stop()
  })

  describe('Default index \'_id\'', function() {
    beforeEach(async () => {
      const options = {
        replicate: false,
        maxHistory: 0,
        path: dbPath,
      }
      db = await orbitdb1.docstore(config.dbname, options)
    })

    afterEach(async () => {
      await db.drop()
    })

    it('put', async () => {
      const doc = { _id: 'hello world', doc: 'all the things'}
      await db.put(doc)
      const value = db.get('hello world')
      assert.deepEqual(value, [doc])
    })

    it('get - partial term match', async () => {
      const doc1 = { _id: 'hello world', doc: 'some things'}
      const doc2 = { _id: 'hello universe', doc: 'all the things'}
      const doc3 = { _id: 'sup world', doc: 'other things'}
      await db.put(doc1)
      await db.put(doc2)
      await db.put(doc3)
      const value = db.get('hello')
      assert.deepEqual(value, [doc1, doc2])
    })

    it('get after delete', async () => {
      const doc1 = { _id: 'hello world', doc: 'some things'}
      const doc2 = { _id: 'hello universe', doc: 'all the things'}
      const doc3 = { _id: 'sup world', doc: 'other things'}
      await db.put(doc1)
      await db.put(doc2)
      await db.put(doc3)
      await db.del('hello universe')
      const value1 = db.get('hello')
      const value2 = db.get('sup')
      assert.deepEqual(value1, [doc1])
      assert.deepEqual(value2, [doc3])
    })

    it('put updates a value', async () => {
      const doc1 = { _id: 'hello world', doc: 'all the things'}
      const doc2 = { _id: 'hello world', doc: 'some of the things'}
      await db.put(doc1)
      await db.put(doc2)
      const value = db.get('hello')
      assert.deepEqual(value, [doc2])
    })

    it('query', async () => {
      const doc1 = { _id: 'hello world', doc: 'all the things', views: 17}
      const doc2 = { _id: 'sup world', doc: 'some of the things', views: 10}
      const doc3 = { _id: 'hello other world', doc: 'none of the things', views: 5}
      const doc4 = { _id: 'hey universe', doc: ''}

      await db.put(doc1)
      await db.put(doc2)
      await db.put(doc3)
      await db.put(doc4)

      const value1 = db.query((e) => e.views > 5)
      const value2 = db.query((e) => e.views > 10)
      const value3 = db.query((e) => e.views > 17)

      assert.deepEqual(value1, [doc1, doc2])
      assert.deepEqual(value2, [doc1])
      assert.deepEqual(value3, [])
    })

    it('query after delete', async () => {
      const doc1 = { _id: 'hello world', doc: 'all the things', views: 17}
      const doc2 = { _id: 'sup world', doc: 'some of the things', views: 10}
      const doc3 = { _id: 'hello other world', doc: 'none of the things', views: 5}
      const doc4 = { _id: 'hey universe', doc: ''}

      await db.put(doc1)
      await db.put(doc2)
      await db.put(doc3)
      await db.del('hello world')
      await db.put(doc4)
      const value1 = db.query((e) => e.views >= 5)
      const value2 = db.query((e) => e.views >= 10)
      assert.deepEqual(value1, [doc2, doc3])
      assert.deepEqual(value2, [doc2])
    })
  })

  describe('Specified index', function() {
    beforeEach(async () => {
      const options = { 
        indexBy: 'doc', 
        replicate: false, 
        maxHistory: 0 
      }
      db = await orbitdb1.docstore(config.dbname, options)
    })

    afterEach(async () => {
      await db.drop()
    })

    it('put', async () => {
      const doc = { _id: 'hello world', doc: 'all the things'}
      await db.put(doc)
      const value = db.get('all')
      assert.deepEqual(value, [doc])
    })

    it('get - matches specified index', async () => {
      const doc1 = { _id: 'hello world', doc: 'all the things'}
      const doc2 = { _id: 'hello world', doc: 'some things'}
      await db.put(doc1)
      await db.put(doc2)
      const value1 = db.get('all')
      const value2 = db.get('some')
      assert.deepEqual(value1, [doc1])
      assert.deepEqual(value2, [doc2])
    })
  })

  describe('Sync', function() {
    const doc1 = { _id: 'hello world', doc: 'all the things'}
    const doc2 = { _id: 'moi moi', doc: 'everything'}

    it('syncs databases', async (done) => {
      const options = { 
        // Set write access for both clients
        write: [
          orbitdb1.key.getPublic('hex'), 
          orbitdb2.key.getPublic('hex')
        ],
      }

      const db1 = await orbitdb1.docstore('docstore sync test', options)
      const db2 = await orbitdb2.docstore(db1.path)

      db2.events.on('write', (dbname, hash, entry, heads) => {
        assert.deepEqual(db2.get('hello world'), [doc1])
        db1.sync(heads)
      })

      db1.events.on('replicated', () => {
        const value = db1.get(doc1._id)
        assert.deepEqual(value, [doc1])
        done()
      })

      try {
        await db2.put(doc1)
        await db1.drop()
        await db2.drop()
      } catch (e) {
        done(e)
      }
    })

    it('doesn\'t sync if peer is not allowed to write to the database', async (done) => {
      let options = { 
        // No write access (only creator of the database can write)
        write: [],
      }

      options = Object.assign({}, options, { path: dbPath + '/sync-test/1' })
      const db1 = await orbitdb1.docstore('write error test 1', options)

      options = Object.assign({}, options, { path: dbPath + '/sync-test/2' })
      const db2 = await orbitdb2.docstore(db1.path, options)

      db2.events.on('write', (dbname, hash, entry, heads) => {
        assert.deepEqual(db1.get('hello world'), [])
        setTimeout(() => {
          db1.sync(heads)
          assert.deepEqual(db1.get('hello world'), [])
          assert.deepEqual(db2.get('hello world'), [doc1])
          done()
        }, 500)
      })

      db1.events.on('replicated', () => {
        done(new Error('Shouldn\'t replicate!'))
      })

      try {
        await db2.put(doc1)
      } catch (e) {
        done(e)
      }
    })

    it('throws an error if peer is not allowed to write to the database', async () => {
      let options = { 
        // No write access (only creator of the database can write)
        write: [],
      }

      options = Object.assign({}, options, { path: dbPath + '/sync-test/1' })
      const db1 = await orbitdb1.docstore('write error test 2', options)

      options = Object.assign({}, options, { path: dbPath + '/sync-test/2', sync: true })
      const db2 = await orbitdb2.docstore(db1.path, options)

      let err
      try {
        await db2.put(doc1)
      } catch (e) {
        err = e.toString()
      }
      assert.equal(err, 'Error: Not allowed to write')
    })
  })
})
