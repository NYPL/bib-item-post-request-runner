const Reposter = require('./reposter')

class MultiReposter {
  repostAll (options) {
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
      const jobOptions = Object.assign({
        start: 0,
        limit: false
      }, options)

      const reposter = new Reposter()
      reposter.repost(job.type, job.nyplSource, jobOptions)
      this.reposters.push(reposter)

      // setTimeout(() => this.monitor(), 1000)
    }))
  }

  monitor () {
    // const numJobsWithKnownProgress = this.reposters.filter((reposter) => reposter.runMonitor.getProgress()

    // reposter.runMonitor.getProgress(which, params.nyplSource, resp.lastId, processedCount)
  }
}

module.exports = MultiReposter
