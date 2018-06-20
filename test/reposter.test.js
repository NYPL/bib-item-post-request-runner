const Reposter = require('../lib/reposter')
const NyplApiClient = require('@nypl/nypl-data-api-client')
const dotenv = require('dotenv')
const sinon = require('sinon')

// Load sample env vars so that NyplDataApiClient thinks it has config:
dotenv.config({ path: './config/sample.env' })

describe('Reposter', function () {
  const stubbedPostFunction = (path, params) => {
    const response = Object.assign({}, params, {
      // Append '0' to previous lastId so that we appear to be progressing
      // through alphabetically increasing ids:
      lastId: params.lastId + '0',
      // Increase lastUpdatedDate by 1000ms to emulate moving forward through
      // records by timestamp:
      lastUpdatedDate: params.lastUpdatedDate ? (new Date(Date.parse(params.lastUpdatedDate) + 1000)).toISOString() : null
    })
    return Promise.resolve(response)
  }

  describe('repost', function () {
    let reposter = null

    beforeEach(() => {
      // Stub NyplApiClient to respond with fake lastId
      sinon.stub(NyplApiClient.prototype, 'post').callsFake(stubbedPostFunction)

      reposter = new Reposter()
    })

    afterEach(() => {
      // Disable stub
      NyplApiClient.prototype.post.restore()
      reposter = null
    })

    it('should fail if invalid options given', function () {
      return Promise.all([
        expect(reposter.repost()).to.eventually.be.rejected,
        expect(reposter.repost('bib')).to.eventually.be.rejected,
        expect(reposter.repost('bibs', 'nonsense-nypl-source')).to.eventually.be.rejected,
        expect(reposter.repost('crocodiles', 'sierra-nypl')).to.eventually.be.rejected,
        expect(reposter.repost('bibs', 'sierra-nypl', { limit: 'cats' })).to.eventually.be.rejected,
        expect(reposter.repost('bibs', 'sierra-nypl', { limit: -1 })).to.eventually.be.rejected,
        expect(reposter.repost('bibs', 'sierra-nypl', { limit: 4, batchSize: 'lots' })).to.eventually.be.rejected,
        expect(reposter.repost('bibs', 'sierra-nypl', { limit: 4, batchSize: 2, batchDelay: -1 })).to.eventually.be.rejected
      ])
    })

    it('should succeed if valid options given', function () {
      return Promise.all([
        expect(reposter.repost('bibs', 'sierra-nypl')).to.eventually.be.fulfilled,
        expect(reposter.repost('items', 'recap-cul')).to.eventually.be.fulfilled,
        expect(reposter.repost('bibs', 'sierra-nypl', { limit: 4, batchSize: 2, batchDelay: 100 })).to.eventually.be.fulfilled
      ])
    })

    it('should respect batchSize', function () {
      return reposter.repost('bibs', 'sierra-nypl', { limit: 10, batchSize: 3 }).then(() => {
        return expect(NyplApiClient.prototype.post.callCount).to.equal(4)
      })
    })

    it('should respect batchDelay', function () {
      const startTime = new Date()
      const batchSize = 3
      const batchDelay = 100
      return reposter.repost('bibs', 'sierra-nypl', { limit: 10, batchSize, batchDelay }).then(() => {
        const ellapsed = (new Date()) - startTime
        // We expect one period of delay in between each batch:
        const expectedEllapsed = (batchSize - 1) * batchDelay
        return expect(ellapsed).to.be.at.least(expectedEllapsed)
      })
    })

    it('should accept lastUpdatedDate', function () {
      // Repost calls don't resolve the api response (there may be multiple),
      // but expect it to fullfill:
      return expect(reposter.repost('bibs', null, { lastUpdatedDate: new Date('2018-06-11T01:00:00Z') })).to.eventually.be.fulfilled
    })

    it('should process range of lastUpdatedDate', function () {
      // Process three seconds starting at '2018-06-11T01:00:00Z'
      // Our stub function just increments the queried lastUpdatedDate by one s
      // so we expect a 3s range to fire three posts
      return reposter.repost('bibs', null, { lastUpdatedDate: new Date('2018-06-11T01:00:00Z'), lastUpdatedDateStop: new Date('2018-06-11T01:00:03Z') }).then(() => {
        return expect(NyplApiClient.prototype.post.callCount).to.equal(3)
      })
    })
  })

  describe('repost error handling including exponential back-off (takes ~13s)', function () {
    let reposter = null

    // We're testing failures, which incur exponential back-off delays
    // of a little over 4s per call:
    this.timeout(13 * 1000)

    beforeEach(function () {
      let callCount = 0

      // Set up a stub that responds in error every other call:
      sinon.stub(NyplApiClient.prototype, 'post').callsFake((path, params) => {
        callCount += 1

        // First time: respond with rejection (i.e. network error):
        if (callCount % 3 === 1) return Promise.reject()
        // Second time: respond with a 400:
        else if (callCount % 3 === 2) return Promise.resolve({ statusCode: 400 })
        // Third time: respond with success:
        else return stubbedPostFunction(path, params)
      })

      reposter = new Reposter()
    })

    afterEach(function () {
      NyplApiClient.prototype.post.restore()
      reposter = null
    })

    it('should retry on failure', function () {
      // Let's process 3 records with batchSize 2
      // So we expect it to process a batch of 2 followed by a batch of one
      // The stub above is scripted to fail 2/3 of the time
      return expect(reposter.repost('bibs', 'sierra-nypl', { limit: 3, batchSize: 2 })).to.eventually.be.fulfilled
    })
  })
})
