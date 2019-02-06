/* jslint es6 */
"use strict";
const pkg = require('./package.json');
const Web3 = require('web3')
const { getPastEvents } = require('./lib/fetch_events')
const { Exporter } = require('san-exporter')
const exporter = new Exporter(pkg.name)

const BLOCK_INTERVAL = parseInt(process.env.BLOCK_INTERVAL || "100")
const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || "3")

const PARITY_NODE = process.env.PARITY_URL || "http://localhost:8545/";
console.info(`Connecting to parity node ${PARITY_NODE}`)
let web3 = new Web3(new Web3.providers.HttpProvider(PARITY_NODE))

let lastProcessedPosition = {
  blockNumber: parseInt(process.env.START_BLOCK || "-1"),
  primaryKey: parseInt(process.env.START_PRIMARY_KEY || "-1")
}

async function work() {
  const currentBlock = await web3.eth.getBlockNumber() - CONFIRMATIONS
  console.info(`Fetching transfer events for interval ${lastProcessedPosition.blockNumber}:${currentBlock}`)

  while (lastProcessedPosition.blockNumber < currentBlock) {
    const toBlock = Math.min(lastProcessedPosition.blockNumber + BLOCK_INTERVAL, currentBlock)
    const events = await getPastEvents(web3, lastProcessedPosition.blockNumber + 1, toBlock)

    if (events.length > 0) {
      stableSort(events, transactionOrder)
      for(let i = 0; i < events.length; i++) {
        events[i].primaryKey = lastProcessedPosition.primaryKey + i + 1
      }

      console.info(`Storing and setting primary keys ${events.length} messages for blocks ${lastProcessedPosition.blockNumber + 1}:${toBlock}`)
      
      await exporter.sendDataWithKey(events, "primaryKey")

      lastProcessedPosition.primaryKey += events.length
    }

    lastProcessedPosition.blockNumber = toBlock
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
  await exporter.connect()
  await initLastProcessedBlock()
  await fetchEvents()
}

function transactionOrder(a, b) {
  return a.blockNumber - b.blockNumber
}

function stableSort(array, sortFunc) {
  array.forEach((x, i) => x._position = i)

  array.sort(function(a,b){
    let sortResult = sortFunc(a,b)
    if(sortResult != 0) {
      return sortResult
    }
    else {
      return a._position - b._position
    }
  })

  array.forEach(x => delete x._position)
}

init()
