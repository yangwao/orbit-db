'use strict'

const fs = require('fs')
const path = require('path')
const IpfsDaemon = require('ipfs-daemon/src/ipfs-node-daemon')
const progress = require('progress-string')
const line = require('single-line-log').stdout
const OrbitDB = require('../src/OrbitDB')
const utils = require('../utils')
const csvToObjects = require('./csv-to-objects')
const config = require('./config')

const query = (ipfs, dbname, inputFile, limit, displayProgress) => {
  return new Promise((resolve, reject) => {
    const st = new Date().getTime()
    // const ipfs = new IpfsDaemon(config.daemonConfig)

    // ipfs.on('error', (err) => console.error(err))

    // ipfs.on('ready', () => {
      const orbitdb = new OrbitDB(ipfs)
      const index = orbitdb.docstore(dbname, { 
        maxHistory: -1,
        cachePath: config.databasePath,
        indexBy: 'name',
      })

      const processInput = (filename) => {
        let count = 0
        const st = new Date().getTime()

        const schema = ['added', 'hash', 'name', 'size', 'category']
        let entries = csvToObjects(filename, limit, schema)
        entries.forEach((e) => {
          e.name = e.name.substr(1, e.name.length - 2).trimLeft().trimRight()
        })

        const bar = progress({ 
          width: 48, 
          total: entries.length,
          complete: '█',
          incomplete: '░',
        })

        const outputProgress = (dbname, hash, entry, progress, duration) => {
          process.stdout.write('\r')
          process.stdout.write(`Adding ${bar(progress)} ${progress}/${entries.length} | ${(progress / entries.length * 100).toFixed(1)}% | ${duration}`)
        }

        const onProgress = (entry) => {
          count ++
          if (displayProgress === true) {
            const et = new Date().getTime()
            outputProgress(dbname, null, null, count, new Date(et - st).toISOString().substr(11, 8))
          }
        }

        index.batchPut(entries, onProgress)
          .then((snapshot) => {
            const et = new Date().getTime()

            if (displayProgress === true) {
              process.stdout.write('\n')
            }

            process.stdout.write("Added " + count + " entries to '" + dbname + "' in " + (new Date(et - st).toISOString().substr(11, 8)) + "\n")
            resolve()
          })
      }

      index.events.on('ready', () => processInput(inputFile))
      index.loadFromSnapshot()
    // })
  })
}

module.exports = query
