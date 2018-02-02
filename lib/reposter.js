const NyplDataApiClient = require('@nypl/nypl-data-api-client')
const logger = require('./logger')

class Reposter {
  constructor () {
    if (!process.env.NYPL_API_BASE_URL) throw new Error('NYPL_API_BASE_URL must be set')

    this.apiClient = new NyplDataApiClient()
  }

  /**
   * @typedef {Object} RepostOptions
   * @property {integer} limit - The maximum number of records to repost in
   *   total
   * @property {integer} batchSize - The number of records the bib/item service
   *   should be asked to repost in a given call.
   * @property {string} start - The first id to repost.
   */

  /**
   *  This is the main method to call to issue a batched repost call.
   *
   *  @param {string} which - Specify 'bibs' or 'items' to control what service to hit.
   *  @param {string} nyplSource - Specify a valid nyplSource id (e.g. 'sierra-nypl')
   *  @param {options} nyplSource - Specify a valid nyplSource id (e.g. 'sierra-nypl')
   *  @param {RepostOptions} options - A hash of options
   */
  repost (which, nyplSource, options, processedCount = 0) {
    options = Object.assign({
      limit: 1000,
      batchSize: 100,
      start: ''
    }, options)

    // Validate options
    if (!which || ['bibs', 'items'].indexOf(which) < 0) return Promise.reject(new Error('First argument must specify bibs/items'))
    if (!nyplSource || ['sierra-nypl', 'recap-pul', 'recap-cul'].indexOf(nyplSource) < 0) return Promise.reject(new Error('Second argument must specify valid nyplSource'))
    if (options.limit && (typeof options.limit) !== 'number' || options.limit <= 0) return Promise.reject(new Error('Invalid options.limit. Must be numeric'))
    if (options.batchSize && (typeof options.batchSize) !== 'number' || options.batchSize <= 0) return Promise.reject(new Error('Invalid batchSize. Must be numeric'))
    if (options.batchDelay && (typeof options.batchDelay) !== 'number' || options.batchDelay < 0) return Promise.reject(new Error('Invalid batchDelay. Must be numeric'))

    // Make sure (relevant if this is the last batch) we trim the batchSize to
    // respect the global limit:
    options.batchSize = Math.min(options.batchSize, options.limit - processedCount)

    // Build POST path based on which (bibs/items):
    const path = `${which.replace(/s$/, '')}-post-requests`
    // Build params to POST:
    const params = {
      nyplSource,
      lastId: options.start,
      limit: options.batchSize
    }

    // Closured handler for successful respost requests:
    const handleResponse = (resp) => {
      // Make sure we received a valid response with `limit` and `lastId`:
      if (!resp || !resp.limit || (typeof resp.limit) !== 'number' || !resp.lastId) throw new Error(`Invalid response from ${path}: ${JSON.stringify(resp)}`)
      // Make sure the returned `lastId` represents forward progress:
      if (resp.lastId <= options.start) throw new Error(`Response from ${path} gave non-incrementing lastId: ${resp.lastId}`)

      logger.debug('Reposter: Got response', { resp })

      // After a successful respost, increment processed count:
      processedCount += resp.limit

      logger.info(`Reposter: Processed ${processedCount} of ${options.limit}`, { processedCount, options })

      // If we have more batches to process, recurse:
      if (processedCount < options.limit) {
        // Submit a new batch starting from last seen id:
        let newOptions = Object.assign(options, {
          start: resp.lastId,
          batchSize: options.batchSize
        })
        return this.delay(options.batchDelay)
          .then(() => this.repost(which, nyplSource, newOptions, processedCount))
      }
    }

    // TODO Remove setTimeout call above and uncomment below when repost
    // service ready
    logger.debug('Reposter: POSTING to ' + process.env.NYPL_API_BASE_URL + path, params)
    return this.doPost(path, params).then(handleResponse)
  }

  doPost (path, params, retryCount = 3) {
    return this.apiClient.post(path, params)
      .then((body) => {
        // If there's an http error, nypl-data-api-client won't actually reject
        //   (Issue: https://github.com/NYPL-discovery/node-nypl-data-api-client/issues/6 )
        // Handle statusCode errors like {"statusCode":500,"type":"exception","message":"Unable to publish messages..."}:
        // Throw them so that our general purpose error handling catches them below
        if (body && body.statusCode && body.statusCode >= 400) throw new Error(`Repost: Received ${body.statusCode} from ${path}`, { body })

        return body
      })
      .catch((e) => {
        logger.error(`Reposter: Error posting to ${path}, retries left: ${retryCount}`, { params })

        if (retryCount > 0) return this.delay(500).then(() => this.doPost(path, params, retryCount - 1))
        else throw new Error(`Reposter: Exhausted retries after receiving ${path} errors`)
      })
  }

  /**
   *  Utility function to delay a promise chain
   *
   *  @param {integer} timeMs - Amount to time (in ms) to pause.
   *
   *  @return {Promise} a promise that resolves `null` after specified delay
   */
  delay (timeMs) {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, timeMs)
    })
  }
}

module.exports = Reposter
