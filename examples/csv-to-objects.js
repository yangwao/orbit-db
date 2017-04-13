'use strict'

const fs = require('fs')

const csvToObjects = (filename, limit, schema = []) => {
  const input = fs.readFileSync(filename, 'UTF-8')
  const lines = input.split('\n')

  const entries = lines.slice(0, limit).reduce((res, line) => {
    if (!line.startsWith('#')) {
      const data = line.split(';')

      let obj = {}
      schema.forEach(e => obj[e] = null)
      Object.keys(obj).forEach((e, idx) => {
        obj[e] = data[idx] ? data[idx] : null
      })
      // const entry = { 
      //   ts: data[0],
      //   hash: data[1],
      //   name: data[2].substr(1, data[2].length - 2).trimLeft().trimRight(),
      //   size: data[3],
      //   category: data[4],
      // }
      res.push(obj)
    }
    return res
  }, [])

  return entries
}

module.exports = csvToObjects
