const dotenv = require('dotenv')
const minimist = require('minimist')
const fs = require('fs')

const argv = minimist(process.argv, {
  default: {
    start: '0',
    limit: 1000,
    batchSize: 100
  }
})

const Reposter = require('./lib/reposter.js')

const which = argv._[2]
const nyplSource = argv._[3]
const start = argv.start
const limit = argv.limit
const batchSize = argv.batchSize

if (!which || ['bibs', 'items'].indexOf(which) < 0) throw new Error('First argument must specify bibs/items')
if (!nyplSource || ['sierra-nypl', 'recap-pul', 'recap-cul'].indexOf(nyplSource) < 0) throw new Error('Second argument must specify valid nyplSource')
if (limit && (typeof limit) !== 'number') throw new Error('Invalid limit. Must be numeric')
if (batchSize && (typeof batchSize) !== 'number') throw new Error('Invalid batchSize. Must be numeric')

if (!argv.envfile || !fs.existsSync(argv.envfile)) throw new Error('Must specify --envfile')
dotenv.config({ path: argv.envfile })

console.log(`Running repost on ${which}, start at '${start}', limit ${limit} in batches of ${batchSize}`)

const reposter = new Reposter()
reposter.repost(which, nyplSource, { start, limit })

