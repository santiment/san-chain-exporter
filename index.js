"use strict";
const pkg = require('./package.json');
const { send } = require('micro')
const url = require('url')
const { Exporter } = require('san-exporter')
const metrics = require('san-exporter/metrics');
const { logger } = require('./lib/logger')
const { storeEvents } = require('./lib/store_events')
const { ERC20Worker } = require('./blockchains/erc20/erc20_worker')
const { ETHWorker } = require('./blockchains/eth/eth_worker')

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
    this.exporter = new Exporter(pkg.name, true)
    await this.exporter.connect()
    this.exporter.initTransactions()
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
      const events = await this.worker.work()
      metrics.currentBlock.set(this.worker.lastConfirmedBlock);
      metrics.requestsCounter.inc();
      metrics.requestsResponseTime.observe(new Date() - this.worker.lastRequestStartTime);
      metrics.lastExportedBlock.set(this.worker.lastExportedBlock);

      this.lastProcessedPosition.blockNumber = this.worker.lastExportedBlock
      this.lastProcessedPosition.primaryKey = this.worker.lastPrimaryKey

      await storeEvents(this.exporter, events)
      await this.exporter.savePosition(this.lastProcessedPosition)
      logger.info(`Progressed to position ${JSON.stringify(this.lastProcessedPosition)}`)

      const _this = this
      setTimeout(function() {_this.workLoop()}, _this.worker.sleepTimeMsec)
    }
    catch(ex) {
      console.error("Error in exporter work loop: ", ex)
    }
  }

  async setWorker() {
    if (this.worker != null) {
      throw new Error("Worker is already set")
    }

    switch (process.env.BLOCKCHAIN) {
      case "erc20":
        this.worker = new ERC20Worker()
        break
      case "eth":
          this.worker = new ETHWorker()
          break
      default:
        throw new Error(`Blockchain set to ${process.env.BLOCKCHAIN} but no such worker is defined`)
    }

    this.worker.lastExportedBlock = this.lastProcessedPosition.blockNumber
    this.worker.lastPrimaryKey = this.lastProcessedPosition.primaryKey
    await this.worker.init()
  }

  healthcheck() {
    return healthcheckKafka()
    .then(() => this.worker.healthcheck())
  }

  healthcheckKafka() {
    if (this.exporter.producer.isConnected()) {
      return Promise.resolve()
    } else {
      return Promise.reject("Kafka client is not connected to any brokers")
    }
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
          .catch((err) => send(response, 500, err.toString()))
    case '/metrics':
      response.setHeader('Content-Type', metrics.register.contentType);
      return send(response, 200, metrics.register.metrics());
    default:
      return send(response, 404, 'Not found');
  }
}
