const dotenv = require('dotenv')
const minimist = require('minimist')
const fs = require('fs')
const path = require('path')
const prompt = require('prompt')

const argv = minimist(process.argv, {
  default: {
    start: '',
    ids: '',
    batchSize: 100,
    batchDelay: 0
  },
  string: ['ids']
})

if (!argv.envfile || !fs.existsSync(argv.envfile)) throw new Error('Must specify --envfile')
dotenv.config({ path: argv.envfile })

const Reposter = require('./lib/reposter.js')

let which = argv._[2]
let nyplSource = argv._[3]
// Validate nyplSource:
nyplSource = ['sierra-nypl', 'recap-pul', 'recap-cul', 'recap-hl'].indexOf(nyplSource) < 0 ? null : nyplSource

let start = argv.start
let ids = argv.ids.split(',').filter((id) => id)
let limit = argv.limit
let batchSize = argv.batchSize
let batchDelay = argv.batchDelay
let lastUpdatedDate = argv.lastUpdatedDate
let lastUpdatedDateStop = argv.lastUpdatedDateStop

function promptWithDefault (question, defaultValue) {
  return new Promise((resolve, reject) => {
    prompt.start()
    prompt.get(question, (e, result) => {
      resolve(result[question] || defaultValue)
    })
  })
}

function arrayChunks (arr, chunkSize) {
  const groups = []
  let i = 0
  while (i < arr.length) {
    groups.push(arr.slice(i, i += chunkSize))
  }
  return groups
}

function runWithOptions () {
  if (!which || ['bibs', 'items'].indexOf(which) < 0) throw new Error('First argument must specify bibs/items')
  if (!nyplSource && !lastUpdatedDate) throw new Error('Second argument must specify valid nyplSource')
  if (limit && (typeof limit) !== 'number') throw new Error('Invalid limit. Must be numeric')
  if (batchSize && (typeof batchSize) !== 'number') throw new Error('Invalid batchSize. Must be numeric')
  if (batchDelay && (typeof batchDelay) !== 'number') throw new Error('Invalid batchDelay. Must be numeric')
  if (lastUpdatedDate) lastUpdatedDate = new Date(lastUpdatedDate)
  if (lastUpdatedDateStop) lastUpdatedDateStop = new Date(lastUpdatedDateStop)

  console.log([
    `Running repost on ${which}`,
    ids ? `for ids ${ids.join(', ')}` : '',
    lastUpdatedDate ? `from timestamp ${lastUpdatedDate} to ${lastUpdatedDateStop}` : `start at '${start}'`,
    limit ? `limit ${limit} in batches of ${batchSize}` : ' no limit',
    batchDelay ? ` with ${batchDelay}ms batch delay}` : ''
  ].join(', '))

  // Build logging path using env (e.g. production), source, and type
  const loggingNamespace = `${path.basename(argv.envfile, '.env')}-${nyplSource}-${which}`
  const reposter = new Reposter({ loggingNamespace })

  if (argv.dryrun) {
    console.log(`reposter.repost(${which}, ${nyplSource}, ${JSON.stringify({ start, ids, limit, batchSize, batchDelay, lastUpdatedDate, lastUpdatedDateStop })})`)
    return Promise.resolve()
  } else {
    return reposter.repost(which, nyplSource, { start, ids, limit, batchSize, batchDelay, lastUpdatedDate, lastUpdatedDateStop })
      .catch((e) => {
        console.log(`Encountered error: ${e.name}\n  ${e.message}`)
      })
  }
}

let csvChunkIndex = 0
function runOverCsv (chunks) {
  ids = chunks[csvChunkIndex]

  if (ids && ids.length > 0) {
    runWithOptions()
      .then(() => {
        csvChunkIndex += 1

        console.log(`Finished processing chunk ${csvChunkIndex} of ${chunks.length}`)

        setTimeout(() => runOverCsv(chunks), 100)
      })
  } else {
    console.log('All done')
  }
}

if (!which && !nyplSource) {
  prompt.start()
  prompt.get({
    properties: {
      which: {
        description: 'Repost bibs or items?',
        pattern: /^(bibs|items)$/,
        default: 'bibs',
        required: true
      },
      nyplSource: {
        description: 'NYPL Source?',
        pattern: /^(sierra-nypl|recap-\w{2,3})$/,
        default: 'sierra-nypl',
        required: true
      },
      ids: {
        description: 'Specific ids?',
        pattern: /^(\d+,)*\d+/,
        before: (v) => v.split(',')
      }
    }
  }, (err, result) => {
    which = result.which
    nyplSource = result.nyplSource
    ids = result.ids

    runWithOptions();

    let cmd = `node run ${which} ${nyplSource} --envfile ${argv.envfile}`
    if (ids) cmd += ` --ids ${ids.join(',')}`
    console.log('To replay this:')
    console.log(cmd)
  })
} else if (argv.csv) {
  let csv = fs.readFileSync(argv.csv, 'utf8')
    .split("\n")
  if (argv.offset) csv = csv.slice(argv.offset)
  if (limit) csv = csv.slice(0, limit)

  // the --ids flag seems to have a functional limit of 25
  const chunks = arrayChunks(csv, Math.min(argv.batchSize || 25, 25))
  runOverCsv(chunks)

} else {
  runWithOptions()
}
