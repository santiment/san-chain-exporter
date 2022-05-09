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
  }

  async init() {
    this.exporter = new Exporter(EXPORTER_NAME, true)
    await this.exporter.connect()
    await this.exporter.initTransactions()
    await this.initWorker()
    metrics.startCollection()
  }

  async workLoop() {
    try {
      const lastRequestStartTime = new Date();
      const events = await this.worker.work()
      metrics.currentBlock.set(this.worker.lastConfirmedBlock);
      metrics.requestsCounter.inc(this.worker.getNewRequestsCount());
      metrics.requestsResponseTime.observe(new Date() - lastRequestStartTime);
      metrics.lastExportedBlock.set(this.worker.lastExportedBlock);

      this.lastProcessedPosition = this.worker.getLastProcessedPosition()

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

  async initWorker() {
    if (this.worker != null) {
      throw new Error("Worker is already set")
    }

    this.worker = new worker.worker()

    await this.worker.init(this.exporter, metrics)

    const lastRecoveredPosition = await this.exporter.getLastPosition()
    // Provide the latest recovered from Zookeeper position to the worker. Receive the actual position to start from.
    // This moves the logic of what a proper initial position is to the worker.
    this.lastProcessedPosition = this.worker.initPosition(lastRecoveredPosition)

    await this.exporter.savePosition(this.lastProcessedPosition)
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
