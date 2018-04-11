const dotenv = require('dotenv')
const minimist = require('minimist')
const fs = require('fs')
const path = require('path')

const argv = minimist(process.argv, {
  default: {
    start: '',
    batchSize: 100,
    batchDelay: 0
  }
})

if (!argv.envfile || !fs.existsSync(argv.envfile)) throw new Error('Must specify --envfile')
dotenv.config({ path: argv.envfile })

const Reposter = require('./lib/reposter.js')

const which = argv._[2]
const nyplSource = argv._[3]
const start = argv.start
const limit = argv.limit
const batchSize = argv.batchSize
const batchDelay = argv.batchDelay

if (!which || ['bibs', 'items'].indexOf(which) < 0) throw new Error('First argument must specify bibs/items')
if (!nyplSource || ['sierra-nypl', 'recap-pul', 'recap-cul'].indexOf(nyplSource) < 0) throw new Error('Second argument must specify valid nyplSource')
if (limit && (typeof limit) !== 'number') throw new Error('Invalid limit. Must be numeric')
if (batchSize && (typeof batchSize) !== 'number') throw new Error('Invalid batchSize. Must be numeric')
if (batchDelay && (typeof batchDelay) !== 'number') throw new Error('Invalid batchDelay. Must be numeric')

console.log([
  `Running repost on ${which}`,
  `start at '${start}'`,
  limit ? `limit ${limit} in batches of ${batchSize}` : ' no limit',
  batchDelay ? ` with ${batchDelay}ms batch delay}` : ''
].join(', '))

// Build logging path using env (e.g. production), source, and type
const loggingNamespace = `${path.basename(argv.envfile, '.env')}-${nyplSource}-${which}`
const reposter = new Reposter({ loggingNamespace })

reposter.repost(which, nyplSource, { start, limit, batchSize, batchDelay })
  .catch((e) => {
    console.log(`Encountered error: ${e.name}\n  ${e.message}`)
  })

