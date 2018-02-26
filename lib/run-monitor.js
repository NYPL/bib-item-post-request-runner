const fs = require('fs')
const lockfile = require('lockfile')
const deepmerge = require('deepmerge')

const SAVE_PATH = './run-monitor.json'

class RunMonitor {

  constructor (props = {}) {
    this.stats = props.stats || {}
  }

  /**
   *  Set one/more stats for a given type/nyplSource pair
   *
   *  @param type {string} String indicating "bibs" or "items"
   *  @param nyplSource {string} String identifying source (e.g. "sierra-nypl", "recap-pul")
   *  @param properties {hash} Arbitrary hash of properties to set
   *
   *  @example
   *  // This sets
   */
  setStat (type, nyplSource, properties) {
    if (!this.stats[type]) this.stats[type] = {}
    if (!this.stats[type][nyplSource]) this.stats[type][nyplSource] = {}

    this.stats[type][nyplSource] = Object.assign(this.stats[type][nyplSource], properties)
    return this._save()
  }

  /**
   *  Get an estimate of progress (expressed as a float between 0..1)
   *  for type/nyplSource pair given current id and processed count
   */
  getProgress (type, nyplSource, id, processed) {
    if (this.stats && this.stats[type] && this.stats[type][nyplSource]) {
      const stats = this.stats[type][nyplSource]
      let total = stats.total
      return 1.0 * processed / total
    }
  }

  /**
   *  Save serialized data to disk
   */
  _save () {
    return this._obtainLock()
      .then(() => {
        // Load instance from disk in case other monitors wrote stats recently
        const persistedInstance = RunMonitor.loadSync()
        // Deep-merge persisted stats with my stats
        this.stats = deepmerge(persistedInstance.stats, this.stats)

        const content = RunMonitor.serialize(this)

        fs.writeFile(SAVE_PATH, content, (err, content) => {
          if (err) return Promise.reject(err)

          return
        })
      })
      .then(() => this._releaseLock())
      .then(() => this)
      .catch((e) => {
        this._releaseLock()
        throw e
      })
  }

  /**
   *  Obtain lock on save file
   */
  _obtainLock () {
    return new Promise((resolve, reject) => {
      // Obtain lock on lockfile, waiting as much as 2s
      lockfile.lock(`${SAVE_PATH}.lock`, { wait: 2000 }, (err) => {
        if (err) return reject(err)
        else resolve()
      })
    })
  }

  /**
   *  Release lock on save file
   */
  _releaseLock () {
    return new Promise((resolve, reject) => {
      lockfile.unlock(`${SAVE_PATH}.lock`, (err) => {
        if (err) return reject(err)
        else resolve()
      })
    })
  }

  /**
   *  Load an instance of RunMonitor from disk (syncronously)
   */
  static loadSync () {
    let content = null
    try {
      content = fs.readFileSync(SAVE_PATH, 'utf8')
    } catch (err) {
      // If file doesn't exist, just instantiate empty.
      // Otherwise throw error:
      if (err.code !== 'ENOENT') throw err
    }
    return RunMonitor.deserialize(content)
  }

  /**
   *  Get a string representation of given RunMonitor instance
   */
  static serialize (obj) {
    return JSON.stringify(obj, null, 2)
  }

  /**
   *  Get an instance of RunMonitor from given string serialization
   */
  static deserialize (str = null) {
    const props = str ? JSON.parse(str) : {}
    const inst = new RunMonitor(props)
    return inst
  }
}

module.exports = RunMonitor
