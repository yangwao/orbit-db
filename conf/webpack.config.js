'use strict'

const path = require('path')
const Uglify = require('uglifyjs-webpack-plugin')

module.exports = {
  entry: './src/OrbitDB.js',
  output: {
    libraryTarget: 'var',
    library: 'OrbitDB',
    filename: './dist/orbitdb.min.js'
  },
  target: 'web',
  devtool: 'source-map',
  node: {
    console: false,
    Buffer: true
  },
  plugins: [
    new Uglify(),
  ],
  resolve: {
    modules: [
      'node_modules',
      path.resolve(__dirname, '../node_modules')
    ]
  },
  resolveLoader: {
    modules: [
      'node_modules',
      path.resolve(__dirname, '../node_modules')
    ],
    moduleExtensions: ['-loader']
  },
}
