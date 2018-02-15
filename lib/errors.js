/**
 *  Thrown when an unknown error thrown by bib/item post request services
 */
class UpstreamError extends Error {
  constructor (message) {
    super()
    this.name = 'UpstreamError'
    this.message = message
  }
}

/**
 *  Thrown when bib/item post request service responds that it has reached the end
 */
class NoMoreRecordsError extends Error {
  constructor (message) {
    super()
    this.name = 'NoMoreRecordsError'
    this.message = message
  }
}

module.exports = { NoMoreRecordsError, UpstreamError }
