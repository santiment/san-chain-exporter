/* jslint es6 */
"use strict";
const pkg = require('./package.json');
const Web3 = require('web3')
const { send } = require('micro')
const url = require('url')
const { stableSort } = require('./lib/util')
const { getPastEvents } = require('./lib/fetch_events')
const { Exporter } = require('@santiment-network/san-exporter')
const exporter = new Exporter(pkg.name)
const metrics = require('./lib/metrics');
const { logger } = require('./logger')

const BLOCK_INTERVAL = parseInt(process.env.BLOCK_INTERVAL || "100")
const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || "3")
// This multiplier is used to expand the space of the output primary keys. This allows for the event indexes to be added to the primary key.
const PRIMARY_KEY_MULTIPLIER = 10000
const EXPORT_TIMEOUT_MLS = parseInt(process.env.EXPORT_TIMEOUT_MLS || 1000 * 60 * 5)     // 5 minutes

const PARITY_NODE = process.env.PARITY_URL || "http://localhost:8545/";
console.info(`Connecting to parity node ${PARITY_NODE}`)
let web3 = new Web3(new Web3.providers.HttpProvider(PARITY_NODE))

let lastProcessedPosition = {
  blockNumber: parseInt(process.env.START_BLOCK || "-1"),
  primaryKey: parseInt(process.env.START_PRIMARY_KEY || "-1")
}
// To prevent healthcheck failing during initialization and processing first part of data, we set lastExportTime to current time.
let lastExportTime = Date.now()


async function work() {
  const currentBlock = await web3.eth.getBlockNumber() - CONFIRMATIONS

  while (lastProcessedPosition.blockNumber < currentBlock) {
    const toBlock = Math.min(lastProcessedPosition.blockNumber + BLOCK_INTERVAL, currentBlock)
    console.info(`Fetching transfer events for interval ${lastProcessedPosition.blockNumber}:${toBlock}`)
    metrics.requestsCounter.inc();
    const startTime = new Date();

    const events = await getPastEvents(web3, lastProcessedPosition.blockNumber + 1, toBlock);
    metrics.requestsResponseTime.observe(new Date() - startTime);

    if (events.length > 0) {
      stableSort(events, transactionOrder)
      const lastEvent = events[events.length -1]
      if (lastEvent.logIndex >= PRIMARY_KEY_MULTIPLIER) {
        console.error(`An event with log index ${lastEvent.logIndex} is breaking the primaryKey generation logic at block ${lastEvent.blockNumber}`)
      }
      for (let i = 0; i < events.length; i++) {
        const event = events[i]
        event.primaryKey = event.blockNumber * PRIMARY_KEY_MULTIPLIER + event.logIndex
      }

      console.info(`Storing and setting primary keys ${events.length} messages for blocks ${lastProcessedPosition.blockNumber + 1}:${toBlock}`)

      await exporter.sendDataWithKey(events, "primaryKey")

      lastProcessedPosition.primaryKey = lastEvent.primaryKey
      lastExportTime = Date.now()
    }

    lastProcessedPosition.blockNumber = toBlock
    metrics.currentLedger.set(lastProcessedPosition.blockNumber);
    await exporter.savePosition(lastProcessedPosition)
  }
}

async function fetchEvents() {
  await work()
    .then(() => {
      console.log(`Progressed to position ${JSON.stringify(lastProcessedPosition)}`)

      // Look for new events every 30 sec
      setTimeout(fetchEvents, 30 * 1000)
    })
}

async function initLastProcessedBlock() {
  const lastPosition = await exporter.getLastPosition()

  if (lastPosition) {
    lastProcessedPosition = lastPosition
    console.info(`Resuming export from position ${JSON.stringify(lastPosition)}`)
  } else {
    await exporter.savePosition(lastProcessedPosition)
    console.info(`Initialized exporter with initial position ${JSON.stringify(lastProcessedPosition)}`)
  }
}

async function init() {
  await exporter.connect();
  await initLastProcessedBlock();
  metrics.startCollection();
  await fetchEvents();
}

function transactionOrder(a, b) {
  const blockDif =  a.blockNumber - b.blockNumber
  if (blockDif != 0) {
    return blockDif
  }
  else {
    return a.logIndex - b.logIndex
  }
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
  const isExportTimeoutExceeded = timeFromLastExport > EXPORT_TIMEOUT_MLS
  if (isExportTimeoutExceeded) {
    return Promise.reject(`Time from the last export ${timeFromLastExport}ms exceeded limit  ${EXPORT_TIMEOUT_MLS}ms.`)
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
