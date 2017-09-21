'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const OrbitDB = require('../src/OrbitDB')
const config = require('./config')
const startIpfs = require('./start-ipfs')

const dbPath = './orbitdb/tests/kvstore'
const ipfsPath = './orbitdb/tests/kvstore/ipfs'

describe('orbit-db - Key-Value Store', function() {
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

  beforeEach(async () => {
    db = await orbitdb1.kvstore(config.dbname, { path: dbPath })
  })

  afterEach(async () => {
    await db.drop()
  })

  it('put', async () => {
    await db.put('key1', 'hello1')
    const value = db.get('key1')
    assert.equal(value, 'hello1')
  })

  it('get', async () => {
    await db.put('key1', 'hello2')
    const value = db.get('key1')
    assert.equal(value, 'hello2')
  })

  it('put updates a value', async () => {
    await db.put('key1', 'hello3')
    await db.put('key1', 'hello4')
    const value = db.get('key1')
    assert.equal(value, 'hello4')
  })

  it('set is an alias for put', async () => {
    await db.set('key1', 'hello5')
    const value = db.get('key1')
    assert.equal(value, 'hello5')
  })

  it('put/get - multiple keys', async () => {
    await db.put('key1', 'hello1')
    await db.put('key2', 'hello2')
    await db.put('key3', 'hello3')
    const v1 = db.get('key1')
    const v2 = db.get('key2')
    const v3 = db.get('key3')
    assert.equal(v1, 'hello1')
    assert.equal(v2, 'hello2')
    assert.equal(v3, 'hello3')
  })

  it('deletes a key', async () => {
    await db.put('key1', 'hello!')
    await db.del('key1')
    const value = db.get('key1')
    assert.equal(value, null)
  })

  it('deletes a key after multiple updates', async () => {
    await db.put('key1', 'hello1')
    await db.put('key1', 'hello2')
    await db.put('key1', 'hello3')
    await db.del('key1')
    const value = db.get('key1')
    assert.equal(value, null)
  })

  it('get - integer value', async () => {
    const val = 123
    await db.put('key1', val)
    const v1 = db.get('key1')
    assert.equal(v1, val)
  })

  it('get - object value', async () => {
    const val = { one: 'first', two: 2 }
    await db.put('key1', val)
    const v1 = db.get('key1')
    assert.deepEqual(v1, val)
  })

  it('get - array value', async () => {
    const val = [1, 2, 3, 4, 5]
    await db.put('key1', val)
    const v1 = db.get('key1')
    assert.deepEqual(v1, val)
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

      const db1 = await orbitdb1.kvstore(config.dbname, options)
      const db2 = await orbitdb2.kvstore(db1.path, options)

      db1.events.on('error', (e) => {
        console.log(e.stack())
        done(e)
      })

      db2.events.on('write', (dbname, hash, entry, heads) => {
        assert.equal(db1.get('key1'), null)
        assert.equal(db2.get('key1'), 'hello1')
        db1.sync(heads)
      })

      db1.events.on('replicated', () => {
        const value = db1.get('key1')
        assert.equal(value, 'hello1')
        done()
      })

      await db2.put('key1', 'hello1')
    })

    it('doesn\'t sync if peer is not allowed to write to the database', async (done) => {
      let options = { 
        // No write access (only creator of the database can write)
        write: [],
      }

      options = Object.assign({}, options, { path: dbPath + '/sync-test/1' })
      const db1 = await orbitdb1.kvstore(config.dbname, options)

      options = Object.assign({}, options, { path: dbPath + '/sync-test/2' })
      const db2 = await orbitdb2.kvstore(db1.path, options)

      db1.events.on('error', (e) => {
        console.log(e)
        done(e)
      })

      db2.events.on('write', (dbname, hash, entry, heads) => {
        assert.equal(db1.get('key1'), null)
        assert.equal(db2.get('key1'), 'hello2')
        db1.sync(heads)
        setTimeout(() => {
          assert.equal(db1.get('key1'), null)
          done()
        }, 500)
      })

      db1.events.on('replicated', () => {
        done(new Error('Shouldn\'t replicate!'))
      })

      await db2.put('key1', 'hello2')
    })
  })

  // describe('sync', () => {
  //   const options = { 
  //     replicate: false,
  //   }

  //   it('syncs databases', (done) => {
  //     const db1 = orbitdb1.kvstore(config.dbname, options)
  //     const db2 = orbitdb2.kvstore(config.dbname, options)

  //     db1.events.on('error', done)

  //     db2.events.on('write', (dbname, hash, entry, heads) => {
  //       assert.equal(db1.get('key1'), null)
  //       assert.equal(db2.get('key1'), 'hello1')
  //       db1.sync(heads)
  //     })

  //     db1.events.on('synced', () => {
  //       const value = db1.get('key1')
  //       assert.equal(value, 'hello1')
  //       done()
  //     })

  //     db2.put('key1', 'hello1')
  //       .catch(done)
  //   })
  // })
})
