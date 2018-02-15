const winston = require('winston')
winston.emitErrs = false

const logLevel = (process.env.NODE_ENV === 'production') ? 'info' : 'debug'

let loggerTransports = []

// Spewing logs while running tests is annoying
if (process.env.NODE_ENV !== 'test') {
  loggerTransports.push(new winston.transports.Console({
    level: logLevel,
    handleExceptions: true,
    // Default to json logging per standard, but allow override to 'plain':
    json: (process.env.LOG_TYPE ? process.env.LOG_TYPE === 'json' : true),
    stringify: true,
    colorize: true
  }))
}

const logger = new winston.Logger({
  transports: loggerTransports,
  exitOnError: false
})

module.exports = logger
