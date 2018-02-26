const fs = require('fs')
const sinon = require('sinon')

const RunMonitor = require('../lib/run-monitor')

let mockedDisk = null

describe('RunMonitor', function () {
  beforeEach(function () {
    // Re-initialize "disk" as empty hash each run:
    mockedDisk = {}

    // Mock disk writes by saving content to a local hash:
    sinon.stub(fs, 'writeFile').callsFake((path, content, cb) => {
      mockedDisk[path] = content
      cb(null)
    })
    // Mock disk (sync) disk reads by reading from above hash:
    sinon.stub(fs, 'readFileSync').callsFake((path) => {
      return mockedDisk[path]
    })
  })

  afterEach(function () {
    fs.writeFile.restore()
    fs.readFileSync.restore()
  })

  describe('init', function () {
    it('should instantiate empty monitor', function () {
      const monitor = RunMonitor.loadSync()
      expect(monitor).to.be.a('object')
      expect(monitor.stats).to.be.a('object')

      expect(monitor.stats).to.be.a('object')
    })
  })

  describe('write & read', function () {
    it('should write & read run-monitor.json with updated stats', function () {
      let monitor = RunMonitor.loadSync()
      return monitor.setStat('bibs', 'sierra-nypl', { foo: 'bar', count: 16 })
        .then(() => {
          let runExpectations = function (monitor) {
            expect(monitor.stats).to.be.a('object')
            expect(monitor.stats.bibs).to.be.a('object')
            expect(monitor.stats.bibs['sierra-nypl']).to.be.a('object')
            expect(monitor.stats.bibs['sierra-nypl'].foo).to.equal('bar')
            expect(monitor.stats.bibs['sierra-nypl'].count).to.equal(16)
          }
          // Confirm initial setStat meets our expectations:
          runExpectations(monitor)

          // Reinitialize monitor by loading "from disk"
          monitor = RunMonitor.loadSync()

          // Confirm deserialized instance meets same expectations
          runExpectations(monitor)
        })
    })
  })

  describe('multiple parallel instances', function () {
    it('should read and write politely (without losing data)', function () {
      // Run 10 instances of RunMonitor simultaneously:
      return Promise.all(
        Array(10).fill('').map((e, index) => {
          let monitor = RunMonitor.loadSync()
          // Let's contrive one source and one property to write:
          // Set nyplSource to "source-a", "source-b" alternately
          let nyplSource = `source-${index % 2 === 0 ? 'a' : 'b'}`
          // Set property to property-N
          let property = `property-${index}`
          // The value of the property will just be a descriptive string:
          return monitor.setStat('bibs', nyplSource, { [property]: `Writer ${index} monitoring ${nyplSource}, wrote ${property}` })
        })
      ).then(() => {
        let monitor = RunMonitor.loadSync()

        expect(monitor.stats.bibs).to.be.a('object')

        // We expect to source entries: source-a and source-b

        expect(monitor.stats.bibs['source-a']).to.be.a('object')
        // Expect "source-a" to have been written five times:
        expect(Object.keys(monitor.stats.bibs['source-a']).length).to.equal(5)
        expect(monitor.stats.bibs['source-a']['property-0']).to.be.a('string')
        expect(monitor.stats.bibs['source-a']['property-0']).to.equal('Writer 0 monitoring source-a, wrote property-0')
        expect(monitor.stats.bibs['source-a']['property-2']).to.be.a('string')

        expect(monitor.stats.bibs['source-b']).to.be.a('object')
        // Expect "source-b" to have been written five times:
        expect(Object.keys(monitor.stats.bibs['source-b']).length).to.equal(5)
        expect(monitor.stats.bibs['source-b']).to.be.a('object')
        expect(monitor.stats.bibs['source-b']['property-1']).to.be.a('string')
        expect(monitor.stats.bibs['source-b']['property-1']).to.equal('Writer 1 monitoring source-b, wrote property-1')
        expect(monitor.stats.bibs['source-b']['property-3']).to.be.a('string')
      })
    })
  })
})
