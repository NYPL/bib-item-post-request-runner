const NyplDataApiClient = require('@nypl/nypl-data-api-client')

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

    const path = `${which}/repost?nyplSource=${nyplSource}&start=${options.start}&limit=${options.batchSize}`
    console.log('querying ', path)

    // Closured handler for successful respost requests:
    const handleResponse = (resp) => {
      // After a successful respost, increment processed count:
      processedCount += resp.count

      // If we have more batches to process..
      if (processedCount < options.limit) {
        // Submit a new batch starting from last see id:
        let newOptions = Object.assign(options, {
          start: resp.lastId,
          // Make sure - if this is the last batch - we trim the batchSize to
          // respect the global limit:
          batchSize: Math.min(options.limit - processedCount, options.batchSize)
        })
        return this.repost(which, nyplSource, newOptions, processedCount)
      }
    }
    /**
     * TODO This is just for testing batching behavior in lieu of deciding on
     * a contract for the repost endpoint(s):
     */
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve({ count: 100, lastId: options.start + '0' })
      }, 300)
    }).then(handleResponse)

    // TODO Remove setTimeout call above and uncomment below when repost
    // service ready
    // return this.apiClient.post(path).then(handleResponse)
  }
}

module.exports = Reposter
