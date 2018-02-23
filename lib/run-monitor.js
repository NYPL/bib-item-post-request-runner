const fs = require('fs')

const SAVE_PATH = './run-monitor.json'

class RunMonitor {

  constructor (props = {}) {
    this.stats = props.stats
    this.indexes = props.indexes
  }

  setStat (type, nyplSource, properties) {
    if (!this.stats) this.stats = {}
    if (!this.stats[type]) this.stats[type] = {}
    if (!this.stats[type][nyplSource]) this.stats[type][nyplSource] = {}

    // console.log('Saving stat: ', type, nyplSource, properties)
    this.stats[type][nyplSource] = Object.assign(this.stats[type][nyplSource], properties)
    this.save()
  }

  getProgress (type, nyplSource, id, processed) {
    if (this.stats && this.stats[type] && this.stats[type][nyplSource]) {
      const stats = this.stats[type][nyplSource]
      let total = stats.total
      return 1.0 * processed / total
    }
  }

  save () {
    return new Promise((resolve, reject) => {
      const content = RunMonitor.serialize(this)

      fs.writeFile(SAVE_PATH, content, (err, content) => {
        if (err) return reject(err)

        return resolve(this)
      })
    })
  }

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

  static serialize (obj) {
    return JSON.stringify(obj, null, 2)
  }

  static deserialize (str = null) {
    const props = str ? JSON.parse(str) : {}
    const inst = new RunMonitor(props)
    return inst
  }
}

module.exports = RunMonitor
