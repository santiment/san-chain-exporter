const Logger = require('node-json-logger')
const LOG_LEVEL = process.env.LOG_LEVEL || "debug"
const logger = new Logger({ level: LOG_LEVEL})

module.exports = { logger: logger }