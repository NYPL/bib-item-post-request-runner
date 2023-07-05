const NyplDataApiClient = require('@nypl/nypl-data-api-client')
const RunMonitor = require('./run-monitor')
const { NoMoreRecordsError, UpstreamError } = require('./errors')
const logger = require('./logger')
const moment = require('moment-timezone')

const MAX_RETRIES = 10

class Reposter {
  constructor (options = {}) {
    options = Object.assign({
      loggingNamespace: 'default'
    }, options)

    if (!process.env.NYPL_API_BASE_URL) throw new Error('NYPL_API_BASE_URL must be set')

    this.logger = logger(options.loggingNamespace)
    this.apiClient = new NyplDataApiClient()
    this.runMonitor = RunMonitor.loadSync()
  }

  /**
   * @typedef {Object} RepostOptions
   * @property {integer} limit - The maximum number of records to repost in
   *   total
   * @property {integer} batchSize - The number of records the bib/item service
   *   should be asked to repost in a given call.
   * @property {integer} batchDelay - Integer delay in ms to wait between batches
   * @property {string} start - The first id to repost.
   * @property {date} lastUpdatedDate - Date object specifying the updated timestamp to begin processing from
   * @property {date} lastUpdatedDateStop - Date object specifying upper bound of lastUpdatedDate to process
   * @property {date} ids - Array of ids to process
   * @property {boolean} processingAll - Boolean flagging whether or not we're
   *   processing everything, which controls whether or not we record total at
   *   the end. By default this is derived from presence of `start` and/or
   *   `limit`
   */

  /**
   *  Parse args to a repost call
   *
   *  @param {string} which - Specify 'bibs' or 'items' to control what service to hit.
   *  @param {string} nyplSource - Specify a valid nyplSource id (e.g. 'sierra-nypl')
   *  @param {RepostOptions} options - A hash of options
   *  @param {integer} processedCount - Number of records processed so far (used internally by recursive calls)
   */
  parseRepostOptions (which, nyplSource, options = {}, processedCount = 0) {
    options = Object.assign({
      limit: 1000,
      batchSize: 100,
      start: '',
      ids: '',
      lastUpdatedDate: null,
      lastUpdatedDateStop: null,
      onProgress: () => null,
      processingAll: null
    }, options)

    if (options.ids && Array.isArray(options.ids) && options.ids.length === 0) options.ids = null

    // If not explicitly set, set `processingAll` to true if neither `start`
    // nor `limit` is set. If either is set, we're not processing everything.
    if (options.processingAll === null) options.processingAll = !options.ids && !options.start && !options.limit

    // Validate options
    if (!which || ['bibs', 'items'].indexOf(which) < 0) throw new Error('First argument must specify bibs/items')
    if ((!nyplSource || ['sierra-nypl', 'recap-pul', 'recap-cul', 'recap-hl'].indexOf(nyplSource) < 0) && !options.lastUpdatedDate) throw new Error('Second argument must specify valid nyplSource')
    if (options.limit && (typeof options.limit) !== 'number' || ((typeof options.limit) === 'number' && options.limit <= 0)) throw new Error('Invalid options.limit. Must be numeric')
    if (options.batchSize && (typeof options.batchSize) !== 'number' || options.batchSize <= 0) throw new Error('Invalid batchSize. Must be numeric')
    if (options.batchDelay && (typeof options.batchDelay) !== 'number' || options.batchDelay < 0) throw new Error('Invalid batchDelay. Must be numeric')

    // Make sure (relevant if this is the last batch) we trim the batchSize to
    // respect the global limit:
    if (options.limit) options.batchSize = Math.min(options.batchSize, options.limit - processedCount)

    return options
  }

  /**
   *  This is the main method to call to issue a batched repost call.
   *
   *  @param {string} which - Specify 'bibs' or 'items' to control what service to hit.
   *  @param {string} nyplSource - Specify a valid nyplSource id (e.g. 'sierra-nypl')
   *  @param {RepostOptions} options - A hash of options
   *  @param {integer} processedCount - Number of records processed so far (used internally by recursive calls)
   */
  repost (which, nyplSource, options = {}, processedCount = 0) {
    try {
      options = this.parseRepostOptions(which, nyplSource, options, processedCount)
    } catch (e) {
      return Promise.reject(e)
    }

    // Build POST path based on which (bibs/items):
    const path = `${which.replace(/s$/, '')}-post-requests`
    // Build params to POST:
    const params = {
      nyplSource,
      limit: options.batchSize
    }

    // Make sure minimal criteria used:
    if (!options.start && !options.lastUpdatedDate && !options.ids) {
      this.logger.info("No criteria given, so setting lastId (the starting id) to '00' ('0' isn't handled by the bib-post-request endpoint)")
      options.start = '00'
    }

    if (options.start) params.lastId = options.start
    if (options.ids) params.ids = options.ids

    if (options.lastUpdatedDate) {
      // If lastUpdatedDate used, let's first subtract 1s because we know
      // repost service uses it as a strictly-greater-than, but we want
      // to effectively use greater-than-or-equal-to because:
      //   1. That's the preferred meaning for this utility, and
      //   2. It's necessary to paginate over multiple batches without loss:
      //      After processing a batch of records, the response will provide
      //      a new `lastUpdatedDate`, which is the greatest `updated_date`
      //      in the processed set. There may yet be records with that same
      //      `updated_date` that were not processed in that first pass because
      //      of `limit`. Thus, we should reduce `lastUpdatedDate` by the
      //      smallest unit possible to ensure that any records with the
      //      returned `lastUpdatedDate` are processed (in some cases a second
      //      time).

      // Subtract 1s from lastUpdatedDate:
      const lastUpdatedDate = options.lastUpdatedDate - 1000
      // Important to format the date we're posting as ET because repost
      // service seems to ignore TZ suffix and assume ET
      const lastUpdatedDateET = moment.tz(lastUpdatedDate, 'America/New_York').format()
      params.lastUpdatedDate = lastUpdatedDateET
    }

    // Closured handler for successful respost requests:
    const handleResponse = (resp) => {
      // Make sure we received a valid response with `limit` and `lastId`:
      if (!resp || !resp.limit || (typeof resp.limit) !== 'number' || (!resp.ids && !resp.lastId && !resp.lastUpdatedDate)) throw new UpstreamError(`Invalid response from ${path}: ${JSON.stringify(resp)}`)
      // If querying by lastId, make sure the returned `lastId` represents forward progress:
      if (options.start && resp.lastId <= options.start) throw new UpstreamError(`Response from ${path} gave non-incrementing lastId: ${resp.lastId}`)

      // If processing by lastUpdateDate, make sure response includes valid lastUpdatedDate:
      if (options.lastUpdatedDate && (!resp.lastUpdatedDate || isNaN(Date.parse(resp.lastUpdatedDate)))) throw new UpstreamError(`Response from ${path} gave invalid lastUpdatedDate: ${resp.lastUpdatedDate}`)
      // If querying by lastUpdatedDate, make sure we're moving foward
      // (i.e. expect response lastUpdatedDate to be strictly greater than that requested)
      if (options.lastUpdatedDate && (new Date(resp.lastUpdatedDate)) <= options.lastUpdatedDate) throw new UpstreamError(`Response from ${path} gave non-incrementing response lastUpdatedDate (${resp.lastUpdatedDate}) for queried lastUpdatedDate (${options.lastUpdatedDate.toISOString()}) with batchSize ${options.batchSize}`)

      this.logger.debug('Reposter: Got response', { resp })

      // After a successful respost, increment processed count:
      processedCount += resp.limit

      let progressRatio = this.runMonitor.getProgress(which, params.nyplSource, processedCount)
      let progressLabel = ''
      if (progressRatio) progressLabel = `, progress: ${(progressRatio * 100).toFixed(2)}%`

      let recurse = !options.ids && (!options.limit || processedCount < options.limit)

      // If processing by lastUpdatedDate, have we reached lastUpdatedDateStop?
      if (options.lastUpdatedDate && options.lastUpdatedDateStop && (new Date(resp.lastUpdatedDate)) >= options.lastUpdatedDateStop) recurse = false

      options.onProgress({ completionRatio: progressRatio, running: recurse, completed: processedCount, total: this.runMonitor.getStat(which, nyplSource, 'total') })

      this.logger.info(`Reposter: Processed ${processedCount} of ${options.limit || '[all]'}${progressLabel}`, { processedCount, type: which, nyplSource, options })

      // If we have more batches to process, recurse:
      if (recurse) {
        // Submit a new batch starting from last seen id:
        let newOptions = Object.assign(options, {
          start: resp.lastUpdatedDate ? null : resp.lastId,
          lastUpdatedDate: resp.lastUpdatedDate ? new Date(resp.lastUpdatedDate) : null,
          batchSize: options.batchSize
        })
        return this.delay(options.batchDelay)
          .then(() => this.repost(which, nyplSource, newOptions, processedCount))

      // Handle firstId seek:
      } else if (options.limit === 1 && !params.lastId && !params.lastUpdatedDate) {
        return this.runMonitor.setStat(which, params.nyplSource, { firstId: resp.lastId })
      }
    }

    this.logger.debug('Reposter: POSTING to ' + process.env.NYPL_API_BASE_URL + path, JSON.stringify(params))
    return this.doPost(path, params).then(handleResponse)
      .catch((e) => {
        if (e && e.name === 'NoMoreRecordsError') {
          this.logger.info('No more records to process')

          if (params.lastId) {
            let stats = { lastId: String(params.lastId) }

            // Only update total if we processed everything:
            if (options.processingAll) stats.total = processedCount

            return this.runMonitor.setStat(which, params.nyplSource, stats)
          }
        } else if (e && e.name === 'UpstreamError') {
          this.logger.warn('Caught critical UpstreamError. Aborting. Message: ' + e.message)
          throw e
        } else {
          this.logger.error('Critical Error: ' + e.message)
        }
      })
  }

  doPost (path, params, retryCount = 0) {
    return this.apiClient.post(path, params)
      .then((body) => {
        if (body && body.statusCode && body.statusCode === 404) {
          throw new NoMoreRecordsError(`No more records after ${params.start}`)
        }

        // If there's an http error, nypl-data-api-client won't actually reject
        //   (Issue: https://github.com/NYPL-discovery/node-nypl-data-api-client/issues/6 )
        // Handle statusCode errors like {"statusCode":500,"type":"exception","message":"Unable to publish messages..."}:
        // Throw them so that our general purpose error handling catches them below
        if (body && body.statusCode && body.statusCode >= 400) throw new UpstreamError(`Repost: Received ${body.statusCode} from ${path}`, { body })

        // Check for errors like bodies that only contain {"message":"Endpoint request timed out"}
        if (!body || (!body.lastId && !body.ids)) throw new UpstreamError(`Invalid response from ${path}: ${JSON.stringify(body)}`)

        return body
      })
      .catch((e) => {
        // Have we reached the end?
        if (e && e.name === 'NoMoreRecordsError') {
          // Re-throw the error; Don't retry
          throw e
        }

        this.logger.error(`Reposter: Error posting to ${path}, retry ${retryCount}: ${e}`, { params })

        if (retryCount < MAX_RETRIES) {
          // Compute exponential backoff delay (1s, 9s, 27s, 81s, 243s, etc):
          const delaySeconds = Math.pow(3, retryCount)
          params.limit = Math.max(1, Math.floor(params.limit / 2))
          this.logger.debug(`Reposter: Waiting ${delaySeconds}s to rety with reduced limit of ${params.limit}`)
          return this.delay(delaySeconds * 1000).then(() => this.doPost(path, params, retryCount + 1))
        } else {
          throw new Error(`Reposter: Exhausted retries after receiving ${path} errors`)
        }
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
