'use strict'

const fs = require('fs')
const path = require('path')
const IpfsDaemon = require('ipfs-daemon/src/ipfs-node-daemon')
const progress = require('progress-string')
const OrbitDB = require('../src/OrbitDB')
const padString = require('../pad-string')
const utils = require('../utils')
const categories = require('./category-mappings.json')

// const dbname = process.argv[2] || 'feed-add'
const maxHistory = -1
// const searchText = process.argv[4]
const width = process.stdout.columns

const dataPath = './orbit-db-feed-add'
const dbPath = path.join(dataPath, '/db/')
const ipfsPath = path.join(dataPath, '/ipfs/')

let conf = { 
  IpfsDataDir: ipfsPath,
  Addresses: {
    API: '/ip4/127.0.0.1/tcp/0',
    Swarm: ['/ip4/0.0.0.0/tcp/0'],
    Gateway: '/ip4/0.0.0.0/tcp/0'
  },
}

const query = (dbname, searchText, snapshotHash, displayProgress) => {
  return new Promise((resolve, reject) => {
    const st = new Date().getTime()
    let st2
    let newEventCount = 0
    let eventCount = -1

    const ipfs = new IpfsDaemon(conf)

    ipfs.on('error', (err) => console.error(err))

    ipfs.on('ready', () => {    
      const st3 = new Date().getTime()
      const orbitdb = new OrbitDB(ipfs)
      const db = orbitdb.docstore(dbname, { 
        maxHistory: maxHistory, 
        cachePath: dbPath 
      })

      const query = (text) => {
        const hashWidth = 28
        const sizeWidth = 6
        const tsWidth = 20
        const categoryWidth = 13
        const tableWidth = 6 // 6 vertical bars between columns
        const nameWidth = width - hashWidth - sizeWidth - tsWidth - categoryWidth - tableWidth
        const entryToString = (e) => {
          let res = ''
          res += `│`
          res += `${padString(e.name.trimLeft().trimRight(), nameWidth, '...', '')}│`
          res += `${padString(e.hash, hashWidth, '...', '')}│`
          res += `${padString(utils.getHumanReadableBytes(e.size), sizeWidth, '...', '', true)}│`
          res += `${padString(e.added, tsWidth, '...', '')}│`
          res += `${padString(categories[e.category], categoryWidth, '...', '')}│`
          return res
        }

        const isDefined = e => true

        const res = text !== undefined
          ? db.get(text).map(entryToString)
          : db.query(isDefined).map(entryToString)

        let output = ``
        output += `┌${padString('', nameWidth, null, '─')}┬────────────────────────────┬──────┬────────────────────┬─────────────┐\n`
        output += `│ Name${padString('', nameWidth - 5, null, ' ')}│ Hash                       │ Size │ Added              │ Category    │\n`
        output += `├${padString('', nameWidth, null, '─')}┼────────────────────────────┼──────┼────────────────────┼─────────────┤\n`
        output += res.join('\n') + (res.length > 0 ? '\n' : '')
        output += `└${padString('', nameWidth, null, '─')}┴────────────────────────────┴──────┴────────────────────┴─────────────┘\n`

        const et = new Date().getTime()

        process.stdout.write(output)
        process.stdout.write(`Found ${res.length} matches (${et - st3} ms)\n`)
      }

      db.events.on('ready', () => {
        if (eventCount === -1) {
          eventCount = 0

          const outputProgress = (dbname, hash, entry, progressIndex = 0, total = 1) => {
            const bar = progress({ 
              width: 48, 
              total: total || 1,
              complete: '█',
              incomplete: '░',
            })

            const et = new Date().getTime()
            const action = dbname === 'update' ? 'Updating' : 'Loading '
            const duration = dbname === 'update' ? new Date(et - st2).toISOString().substr(11, 8) : new Date(et - st).toISOString().substr(11, 8)
            process.stdout.write('\r')
            process.stdout.write(`${action} database '${db.dbname}' ${bar(progressIndex)} ${padString(progressIndex + '/' + total, total.toString().length * 2 + 1, null, ' ', true)} | ${(progressIndex / total  * 100).toFixed(1)}% | ${duration}`)
          }

          if (displayProgress === true) {
            db.events.on('progress.load', outputProgress)
            // db.events.on('update', () => {
            //   console.log()
            //   st2 = new Date().getTime()
            // })
            // db.events.on('progress.update', (dbname, hash, entry, progressIndex, total) => {
            //   outputProgress('update', hash, entry, progressIndex, total)
            // })
          }

          process.stdout.write(`Loading  database '${db.dbname}' `)
          db.loadFromSnapshot(snapshotHash)
        } else {
          process.stdout.write(`\nSearching '${searchText}' from ${dbname}\n`)
          query(searchText)
          resolve()
        }
      })

      db.load(1)
    })
  })
}

module.exports = query
