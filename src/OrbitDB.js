'use strict'

const EventEmitter  = require('events').EventEmitter
const EventStore    = require('orbit-db-eventstore')
const FeedStore     = require('orbit-db-feedstore')
const KeyValueStore = require('orbit-db-kvstore')
const CounterStore  = require('orbit-db-counterstore')
const DocumentStore = require('orbit-db-docstore')
const Pubsub        = require('orbit-db-pubsub')
const Cache = require('orbit-db-cache')
const path = require('path')

const defaultNetworkName = 'Orbit DEV Network'

class OrbitDB {
  constructor(ipfs, id = 'default', options = {}) {
    this._ipfs = ipfs
    this._pubsub = options && options.broker ? new options.broker(ipfs) : new Pubsub(ipfs, id)
    this.user = { id: id }
    this.network = { name: defaultNetworkName }
    this.events = new EventEmitter()
    this.stores = {}
    this.types = ['eventlog', 'feed', 'docstore', 'counter', 'keyvalue']
  }

  /* Databases */
  feed(dbname, options) {
    return this._createStore(FeedStore, dbname, options)
  }

  eventlog(dbname, options) {
    return this._createStore(EventStore, dbname, options)
  }

  kvstore(dbname, options) {
    return this._createStore(KeyValueStore, dbname, options)
  }

  counter(dbname, options) {
    return this._createStore(CounterStore, dbname, options)
  }

  docstore(dbname, options) {
    return this._createStore(DocumentStore, dbname, options)
  }

  close(dbname) {
    if(this._pubsub) this._pubsub.unsubscribe(dbname)
    if (this.stores[dbname]) {
      this.stores[dbname].events.removeAllListeners('write')
      delete this.stores[dbname]
    }
  }

  disconnect() {
    Object.keys(this.stores).forEach((e) => this.close(e))
    if (this._pubsub) this._pubsub.disconnect()
    this.stores = {}
    this.user = null
    this.network = null
  }

  static isValidType (types, type) {
    return types.includes(type)
  }

  create (dbname, type, directory, options) {
    const p = path.join(directory || './orbitdb', this.user.id)
    this._cache = new Cache(p, dbname)
    options = Object.assign({}, options, { path: p, cache: this._cache })
    return this._cache.load()
      .then(() => this._cache.get(dbname))
      .then((hash) => {
        if (hash) 
          throw new Error(`Database '${dbname}' already exists!`)

          if (!OrbitDB.isValidType(this.types, type))
            throw new Error(`Invalid database type '${type}'.`)
      })
      .then(() => this._cache.set(dbname, dbname.split('/').length === 3 ? dbname.split('/')[1] : this.user.id))
      .then(() => this._cache.set(dbname + '.type', type))
      .then(() => this._cache.set(dbname + '.localhead', null))
      .then(() => this._cache.set(dbname + '.remotehead', null))
      .then(() => this._openDatabase(dbname, type, options))
  }

  async load (dbname, directory, options) {
    const p = path.join(directory || './orbitdb', this.user.id)
    this._cache = new Cache(p, dbname)
    options = Object.assign({}, options, { path: p, cache: this._cache })
    return this._cache.load()
      .then(() => this._cache.get(dbname + '.type'))
      .then((type) => {
        if (!type)
          throw new Error(`Database '${dbname}' doesn't exist.`)

        return this._openDatabase(dbname, type, options)
      })
  }


  _openDatabase (dbname, type, options) {
    if (type === 'counter')
      return this.counter(dbname, options)
    else if (type === 'eventlog')
      return this.eventlog(dbname, options)
    else if (type === 'feed')
      return this.feed(dbname, options)
    else if (type === 'docstore')
      return this.docstore(dbname, options)
    else if (type === 'keyvalue')
      return this.kvstore(dbname, options)
    else
      throw new Error(`Unknown database type '${type}'`)
  }

  /* Private methods */
  _createStore(Store, dbname, options) {
    const opts = Object.assign({ replicate: true }, options)

    const store = new Store(this._ipfs, this.user.id, dbname, opts)
    store.events.on('write', this._onWrite.bind(this))
    store.events.on('ready', this._onReady.bind(this))

    this.stores[dbname] = store

    if(opts.replicate && this._pubsub)
      this._pubsub.subscribe(dbname, this._onMessage.bind(this), this._onConnected.bind(this))

    return store
  }

  /* Replication request from the message broker */
  _onMessage(dbname, heads) {
    // console.log(".MESSAGE", dbname, heads)
    const store = this.stores[dbname]
    store.sync(heads)
  }

  /* Data events */
  _onWrite(dbname, hash, entry, heads) {
    // 'New entry written to database...', after adding a new db entry locally
    // console.log(".WRITE", dbname, hash, this.user.username)
    if(!heads) throw new Error("'heads' not defined")
    if(this._pubsub) setImmediate(() => this._pubsub.publish(dbname, heads))
  }

  _onReady(dbname, heads) {
    // if(heads && this._pubsub) setImmediate(() => this._pubsub.publish(dbname, heads))
    if(heads && this._pubsub) {
      setTimeout(() => this._pubsub.publish(dbname, heads), 1000)
    }
  }

  _onConnected(dbname, peers) {
    // console.log(".PEERS", dbname, peers)
    const store = this.stores[dbname]
    const heads = store._oplog.heads
    setTimeout(() => this._pubsub.publish(dbname, heads), 1000)
  }
}

module.exports = OrbitDB
