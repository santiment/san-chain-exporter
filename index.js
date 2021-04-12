"use strict";
const pkg = require('./package.json');
const Web3 = require('web3')
const { send } = require('micro')
const url = require('url')
const { Exporter } = require('san-exporter')
const exporter = new Exporter(pkg.name)
const metrics = require('san-exporter/metrics');
const { logger } = require('./logger')
const constants = require('./lib/constants')
const work = require('./lib/work')
const { getPastEventsExactContractsFunction } = require('./contract_overwrite')
const { getPastEventsFunction } = require('./fetch_events')

logger.info(`Connecting to parity node ${constants.PARITY_NODE}`)
let web3 = new Web3(new Web3.providers.HttpProvider(constants.PARITY_NODE))

let lastProcessedPosition = {
  blockNumber: parseInt(process.env.START_BLOCK || "-1"),
  primaryKey: parseInt(process.env.START_PRIMARY_KEY || "-1")
}

// To prevent healthcheck failing during initialization and processing first part of data,
// we set lastExportTime to current time.
let lastExportTime = Date.now()

async function work_loop(getEventsFunction) {
  const ethNodeLastBlock = await web3.eth.getBlockNumber()
  await work(exporter,
             ethNodeLastBlock,
             getEventsFunction,
             metrics,
             lastProcessedPosition);
  logger.info(`Progressed to position ${JSON.stringify(lastProcessedPosition)}`)
  // Look for new events every 30 sec
  setTimeout(work_loop, 30 * 1000)
}

async function initLastProcessedBlock() {
  const lastPosition = await exporter.getLastPosition()

  if (lastPosition) {
    lastProcessedPosition = lastPosition
    logger.info(`Resuming export from position ${JSON.stringify(lastPosition)}`)
  } else {
    await exporter.savePosition(lastProcessedPosition)
    logger.info(`Initialized exporter with initial position ${JSON.stringify(lastProcessedPosition)}`)
  }
}

async function init() {
  await exporter.connect();
  exporter.initTransactions();
  await initLastProcessedBlock();
  metrics.startCollection();
  getEventsFunction = (constants.EXACT_CONTRACT_MODE) ?
    getPastEventsExactContractsFunction(web3) :
    getPastEventsFunction(web3, lastProcessedPosition.blockNumber + 1, toBlock);
  work_loop(getEventsFunction);
}

init()

const healthcheckParity = () => {
  return web3.eth.getBlockNumber()
}

const healthcheckKafka = () => {
  if (exporter.producer.isConnected()) {
    return Promise.resolve()
  } else {
    return Promise.reject("Kafka client is not connected to any brokers")
  }
}

const healthcheckExportTimeout = () => {
  const timeFromLastExport = Date.now() - lastExportTime
  const isExportTimeoutExceeded = timeFromLastExport > constants.EXPORT_TIMEOUT_MLS
  if (isExportTimeoutExceeded) {
    return Promise.reject(`Time from the last export ${timeFromLastExport}ms exceeded limit  ${constants.EXPORT_TIMEOUT_MLS}ms.`)
  } else {
    return Promise.resolve()
  }
}

module.exports = async (request, response) => {
  const req = url.parse(request.url, true);

  switch (req.pathname) {
    case '/healthcheck':
      return healthcheckKafka()
          .then(() => healthcheckParity())
          .then(() => healthcheckExportTimeout())
          .then(() => send(response, 200, "ok"))
          .catch((err) => send(response, 500, err.toString()))
    case '/metrics':
      response.setHeader('Content-Type', metrics.register.contentType);
      return send(response, 200, metrics.register.metrics());
    default:
      return send(response, 404, 'Not found');
  }
}
