"use strict";
const pkg = require('./package.json')
const { send } = require('micro')
const url = require('url')
const { Exporter } = require('./lib/kafka_storage')
const metrics = require('./lib/metrics')
const { logger } = require('./lib/logger')
const { storeEvents } = require('./lib/store_events')
// Dynamically initialize just the needed blockchain worker
const worker = require(`./blockchains/${process.env.BLOCKCHAIN}/${process.env.BLOCKCHAIN}_worker`)
const EXPORTER_NAME = process.env.EXPORTER_NAME || pkg.name
const constants = require('./lib/constants')

class Main {
  constructor() {
    // To be set depending on which blockchain worker is configured on runtime
    this.worker = null
    this.lastProcessedPosition = {
      blockNumber: parseInt(process.env.START_BLOCK || "-1"),
      primaryKey: parseInt(process.env.START_PRIMARY_KEY || "-1")
    }
  }

  async init() {
    this.exporter = new Exporter(EXPORTER_NAME, true)
    await this.exporter.connect()
    await this.exporter.initTransactions()
    await this.initLastProcessedBlock()
    await this.setWorker()
    metrics.startCollection()
  }

  async initLastProcessedBlock() {
    const lastPosition = await this.exporter.getLastPosition()

    if (lastPosition) {
      this.lastProcessedPosition = lastPosition
      logger.info(`Resuming export from position ${JSON.stringify(lastPosition)}`)
    } else {
      await this.exporter.savePosition(this.lastProcessedPosition)
      logger.info(`Initialized exporter with initial position ${JSON.stringify(this.lastProcessedPosition)}`)
    }
  }

  async workLoop() {
    try {
      const lastRequestStartTime = new Date();
      const events = await this.worker.work()
      metrics.currentBlock.set(this.worker.lastConfirmedBlock);
      metrics.requestsCounter.inc();
      metrics.requestsResponseTime.observe(new Date() - lastRequestStartTime);
      metrics.lastExportedBlock.set(this.worker.lastExportedBlock);

      this.lastProcessedPosition.blockNumber = this.worker.lastExportedBlock
      this.lastProcessedPosition.primaryKey = this.worker.lastPrimaryKey

      if (events.length > 0) {
        await storeEvents(this.exporter, events)
      }
      await this.exporter.savePosition(this.lastProcessedPosition)
      logger.info(`Progressed to position ${JSON.stringify(this.lastProcessedPosition)}`)

      const _this = this
      setTimeout(function() {_this.workLoop()}, _this.worker.sleepTimeMsec)
    }
    catch(ex) {
      console.error("Error in exporter work loop: ", ex)
      throw ex
    }
  }

  async setWorker() {
    if (this.worker != null) {
      throw new Error("Worker is already set")
    }

    this.worker = new worker.worker()

    this.worker.lastExportedBlock = this.lastProcessedPosition.blockNumber
    this.worker.lastPrimaryKey = this.lastProcessedPosition.primaryKey
    await this.worker.init(this.exporter)
  }

  healthcheckKafka() {
    if (this.exporter.producer.isConnected()) {
      return Promise.resolve()
    } else {
      return Promise.reject("Kafka client is not connected to any brokers")
    }
  }

  healthcheckExportTimeout() {
    const timeFromLastExport = Date.now() - this.worker.lastExportTime
    const isExportTimeoutExceeded = timeFromLastExport > constants.EXPORT_TIMEOUT_MLS
    if (isExportTimeoutExceeded) {
      const errorMessage = `Time from the last export ${timeFromLastExport}ms exceeded limit ` +
        `${constants.EXPORT_TIMEOUT_MLS}ms.`
      return Promise.reject(errorMessage)
    } else {
      return Promise.resolve()
    }
  }

  healthcheck() {
    return this.healthcheckKafka()
    .then(() => this.healthcheckExportTimeout())
  }
}

const main = new Main()
main.init().then(() => {
  main.workLoop()
})
.catch((ex) => {
  console.error("Error initializing exporter: ", ex)
})


module.exports = async (request, response) => {
  const req = url.parse(request.url, true);

  switch (req.pathname) {
    case '/healthcheck':
      return main.healthcheck()
          .then(() => send(response, 200, "ok"))
          .catch((err) => {
            logger.error(`Healthcheck failed: ${err.toString()}`)
            send(response, 500, err.toString())
          })
    case '/metrics':
      response.setHeader('Content-Type', metrics.register.contentType);
      return send(response, 200, await metrics.register.metrics())
    default:
      return send(response, 404, 'Not found');
  }
}
