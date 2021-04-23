"use strict";
const pkg = require('./package.json');
const { send } = require('micro')
const url = require('url')
const { Exporter } = require('san-exporter')
const exporter = new Exporter(pkg.name)
const metrics = require('san-exporter/metrics');
const { logger } = require('./logger')
const { storeEvents } = require('./lib/store_events')
const { ERC20Worker } = require('./blockchains/erc20/erc20_worker')

let lastProcessedPosition = {
  blockNumber: parseInt(process.env.START_BLOCK || "-1"),
  primaryKey: parseInt(process.env.START_PRIMARY_KEY || "-1")
}

// To be set depending on which blockchain worker is configured on runtime
let worker = null

class Main {
  constructor() {
    worker = null
  }

  async init() {
    this.worker = setWorker()
    await exporter.connect()
    exporter.initTransactions()
    await initLastProcessedBlock()
    metrics.startCollection()
  }

  async initLastProcessedBlock() {
    const lastPosition = await exporter.getLastPosition()

    if (lastPosition) {
      lastProcessedPosition = lastPosition
      logger.info(`Resuming export from position ${JSON.stringify(lastPosition)}`)
    } else {
      await exporter.savePosition(lastProcessedPosition)
      logger.info(`Initialized exporter with initial position ${JSON.stringify(lastProcessedPosition)}`)
    }
  }

  async workLoop() {
    const events = await this.worker.work()
    metrics.currentBlock.set(this.worker.lastConfirmedBlock);
    metrics.requestsCounter.inc();
    metrics.requestsResponseTime.observe(new Date() - this.worker.lastRequestStartTime);
    metrics.lastExportedBlock.set(this.worker.lastExportedBlock);

    lastProcessedPosition.blockNumber = this.worker.lastExportedBlock
    lastProcessedPosition.primaryKey = this.worker.lastPrimaryKey

    await storeEvents(exporter, events)
    await exporter.savePosition(lastProcessedPosition)
    logger.info(`Progressed to position ${JSON.stringify(lastProcessedPosition)}`)

    setTimeout(workLoop, this.worker.sleepTime)
  }

  setWorker() {
    if (this.worker != null) {
      throw new Error("Worker is already set")
    }

    switch (process.env.BLOCKCHAIN) {
      case "erc20":
        this.worker = new ERC20Worker()
        return worker
      default:
        throw new Error(`Blockchain set to ${process.env.BLOCKCHAIN} but no such worker is defined`)
    }

  }

  getWorker() {
    if (this.worker == null) {
      throw new Error("Worker not set")
    }
    return this.worker
  }
}

const main = Main()
main.init().then(() => {
  main.workLoop
})


const healthcheckKafka = () => {
  if (exporter.producer.isConnected()) {
    return Promise.resolve()
  } else {
    return Promise.reject("Kafka client is not connected to any brokers")
  }
}


module.exports = async (request, response) => {
  const req = url.parse(request.url, true);

  switch (req.pathname) {
    case '/healthcheck':
      return healthcheckKafka()
          .then(() => main.getWorker().healthcheck())
          .then(() => send(response, 200, "ok"))
          .catch((err) => send(response, 500, err.toString()))
    case '/metrics':
      response.setHeader('Content-Type', metrics.register.contentType);
      return send(response, 200, metrics.register.metrics());
    default:
      return send(response, 404, 'Not found');
  }
}
