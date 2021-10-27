const winston = require('winston')
winston.emitErrs = false

const makeLogger = function (namespace, options) {
  options = Object.assign({
    logToFile: `./logs/${namespace}.log`
  }, options)

  const logLevel = process.env.LOG_LEVEL ||
    ((process.env.NODE_ENV === 'production') ? 'info' : 'debug')

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

  if (options.logToFile) {
    const logToFile = new winston.transports.File({ filename: options.logToFile })
    loggerTransports.push(logToFile)
  }

  const logger = new winston.Logger({
    transports: loggerTransports,
    exitOnError: false
  })

  return logger
}

module.exports = makeLogger
