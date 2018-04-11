const Reposter = require('./reposter')
const logger = require('./logger')

class MultiReposter {
  constructor (options = {}) {
    this.options = Object.assign({
      loggingNamespace: 'default'
    }, options)

    this.logger = logger(`${options.loggingNamespace}-all`)

    this.progress = {}
  }

  /**
   * @typedef {Object} RepostAllOptions
   * @property {integer} batchSize - The number of records the bib/item service
   *   should be asked to repost in a given call.
   * @property {integer} batchDelay - Integer delay in ms to wait between batches
   */

  /**
   *  This is the main method to call to issue a repost-all call.
   *
   *  @param {RepostAllOptions} options - A hash of options
   */
  repostAll (options = {}) {
    this.jobs = [
      { type: 'bibs', nyplSource: 'sierra-nypl' },
      { type: 'items', nyplSource: 'sierra-nypl' },
      { type: 'bibs', nyplSource: 'recap-pul' },
      { type: 'items', nyplSource: 'recap-pul' },
      { type: 'bibs', nyplSource: 'recap-cul' },
      { type: 'items', nyplSource: 'recap-cul' }
    ]

    this.reposters = []
    return Promise.all(this.jobs.map((job) => {
      const onProgress = this.createJobProgressLogger(job)
      const jobOptions = Object.assign({
        start: 0,
        limit: false,
        onProgress
      }, options)

      const loggingNamespace = `${this.options.loggingNamespace}-${job.nyplSource}-${job.type}`
      const reposter = new Reposter({ loggingNamespace })
      this.reposters.push(reposter)

      return reposter.repost(job.type, job.nyplSource, jobOptions)
    }))
  }

  /**
   * Analyze collected progress of all jobs and log the result.
   */
  logProgress () {
    const report = Object.keys(this.progress)
      .reduce((report, name) => {
        report.jobs += 1

        const jobProgress = this.progress[name]

        if (jobProgress.running) report.running += 1
        if (jobProgress.total) report.total += jobProgress.total
        if (jobProgress.completed) report.completed += jobProgress.completed
        report.jobStatus[name] = {
          progress: (100 * jobProgress.completionRatio).toFixed(2),
          running: jobProgress.running
        }

        return report
      }, { jobs: 0, running: 0, total: 0, completed: 0, jobStatus: {} })

    report.percentageComplete = (report.completed / report.total * 100).toFixed(3)
    this.logger.info('Run-All Progress', report)

    if (report.running > 0) this.logProgressTimer = setTimeout(() => this.logProgress(), 2000)
  }

  /**
   * Build a closure around a job to log its progress
   */
  createJobProgressLogger (job) {
    const key = `${job.nyplSource}-${job.type}`
    return (values) => {
      this.progress[key] = values

      // Make sure logProgress is running:
      if (!this.logProgressTimer) {
        this.logProgress()
      }
    }
  }
}

module.exports = MultiReposter
