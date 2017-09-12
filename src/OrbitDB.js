'use strict'

const path = require('path')
const EventStore = require('orbit-db-eventstore')
const FeedStore = require('orbit-db-feedstore')
const KeyValueStore = require('orbit-db-kvstore')
const CounterStore = require('orbit-db-counterstore')
const DocumentStore = require('orbit-db-docstore')
const Pubsub = require('orbit-db-pubsub')
const Cache = require('orbit-db-cache')
const parseAddress = require('./parse-address')

class OrbitDB {
  constructor(ipfs, options = {}) {
    this._ipfs = ipfs
    this.id = options.peerId || (this._ipfs._peerInfo ? this._ipfs._peerInfo.id._idB58String : 'default')
    this._pubsub = options && options.broker 
      ? new options.broker(ipfs) 
      : new Pubsub(ipfs, this.id)
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

  disconnect() {
    Object.keys(this.stores).forEach((e) => this.stores[e].close())
    if (this._pubsub) this._pubsub.disconnect()
    this.stores = {}
  }

  create (address, type, directory, options) {
    const p = path.join(directory || './orbitdb')
    const addr = OrbitDB.parseAddress(address, this.id)
    this._cache = new Cache(p, addr.indexOf('/orbitdb') === 0 ? addr.replace('/orbitdb', '') : addr)
    options = Object.assign({}, options, { path: p, cache: this._cache })
    return this._cache.load()
      .then(() => this._cache.get(addr))
      .then((hash) => {
        if (hash) 
          throw new Error(`Database '${addr}' already exists!`)

          if (!OrbitDB.isValidType(this.types, type))
            throw new Error(`Invalid database type '${type}'.`)
      })
      .then(() => this._cache.set(addr + '.type', type))
      .then(() => this._cache.set(addr + '.localhead', null))
      .then(() => this._cache.set(addr + '.remotehead', null))
      .then(() => this._openDatabase(addr, type, options))
  }

  load (address, directory, options) {
    const p = path.join(directory || './orbitdb')
    const addr = OrbitDB.parseAddress(address, this.id)
    this._cache = new Cache(p, addr.indexOf('/orbitdb') === 0 ? addr.replace('/orbitdb', '') : addr)
    options = Object.assign({}, options, { path: p, cache: this._cache })
    return this._cache.load()
      .then(() => this._cache.get(addr + '.type'))
      .then((type) => {
        if (!type && !options.type)
          throw new Error(`Database '${addr}' doesn't exist.`)
        else if (!type && options.type && options.create === true)
          return this.create(address, options.type, directory, options)
        else
          return this._openDatabase(addr, type, options)
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
    const addr = OrbitDB.parseAddress(dbname, this.id)
    const opts = Object.assign({ replicate: true }, options)
    const store = new Store(this._ipfs, this.id, dbname, opts)
    store.events.on('write', this._onWrite.bind(this))
    store.events.on('ready', this._onReady.bind(this))
    store.events.on('close', this._onClose.bind(this))

    this.stores[addr] = store

    if(opts.replicate && this._pubsub)
      this._pubsub.subscribe(addr, this._onMessage.bind(this))

    return store
  }

  // Callback for receiving a message from the network
  _onMessage(dbname, heads) {
    const store = this.stores[dbname]
    store.sync(heads)
  }

  // Callback for local writes to the database. We the update to pubsub.
  _onWrite(dbname, hash, entry, heads) {
    if(!heads) throw new Error("'heads' not defined")
    if(this._pubsub) setImmediate(() => this._pubsub.publish(dbname, heads))
  }

  // Callback for database being ready
  _onReady(dbname, heads) {
    if(heads && this._pubsub) {
      setTimeout(() => this._pubsub.publish(dbname, heads), 1000)
    }
  }

  _onClose(dbname) {
    if(this._pubsub) this._pubsub.unsubscribe(dbname)
    if (this.stores[dbname]) {
      this.stores[dbname].events.removeAllListeners('write')
      this.stores[dbname].events.removeAllListeners('ready')
      this.stores[dbname].events.removeAllListeners('close')
      this.stores[dbname].close()
      delete this.stores[dbname]
    }
  }

  static isValidType (types, type) {
    return types.includes(type)
  }

  static parseAddress (address, id) {
    return parseAddress(address, id)
  }
}

module.exports = OrbitDB
