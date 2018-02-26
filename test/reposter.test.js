const Reposter = require('../lib/reposter')
const NyplApiClient = require('@nypl/nypl-data-api-client')
const dotenv = require('dotenv')
const sinon = require('sinon')

// Load sample env vars so that NyplDataApiClient thinks it has config:
dotenv.config({ path: './config/sample.env' })

describe('Reposter', function () {
  let reposter = null

  const stubbedPostFunction = (path, params) => {
    const response = Object.assign({}, params, {
      // Append '0' to previous lastId so that we appear to be progressing
      // through alphabetically increasing ids:
      lastId: params.lastId + '0'
    })
    return Promise.resolve(response)
  }

  describe('repost', function () {
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
  })

  describe('repost error handling including exponential back-off (takes ~13s)', function () {
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
