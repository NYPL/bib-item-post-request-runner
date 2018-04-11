const dotenv = require('dotenv')
const minimist = require('minimist')
const fs = require('fs')

const argv = minimist(process.argv, {
  default: {
    batchSize: 100,
    batchDelay: 0
  }
})

if (!argv.envfile || !fs.existsSync(argv.envfile)) throw new Error('Must specify --envfile')
dotenv.config({ path: argv.envfile })

const MultiReposter = require('./lib/multi-reposter.js')

const batchSize = argv.batchSize
const batchDelay = argv.batchDelay

if (batchSize && (typeof batchSize) !== 'number') throw new Error('Invalid batchSize. Must be numeric')
if (batchDelay && (typeof batchDelay) !== 'number') throw new Error('Invalid batchDelay. Must be numeric')

console.log([
  'Running multi-repost',
  `in batches of ${batchSize}`,
  batchDelay ? ` with ${batchDelay}ms batch delay}` : ''
].join(', '))

const multiReposter = new MultiReposter()
multiReposter.repostAll({ batchSize, batchDelay })
  .catch((e) => {
    console.log(`Encountered error: ${e.name}\n  ${e.message}`)
  })

