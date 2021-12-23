const Web3 = require('web3')
const jayson = require('jayson/promise');
const constants = require('./lib/constants')
const { logger } = require('../../lib/logger')
const BaseWorker = require('../../lib/worker_base')
const Web3Wrapper = require('../eth/lib/web3_wrapper')
const { extendEventsWithPrimaryKey } = require('../erc20/lib/extend_events_key')
const { getPastEvents } = require('./lib/fetch_events')
const { setGlobalTimestampManager } = require('../erc20/lib/fetch_events')


class MaticWorker extends BaseWorker {
  constructor() {
    super()

    logger.info(`Connecting to Polygon node ${constants.PARITY_NODE}`)
    this.web3 = new Web3(new Web3.providers.HttpProvider(constants.PARITY_NODE))
    this.web3Wrapper = new Web3Wrapper(this.web3)
    this.parityClient = jayson.client.http(constants.PARITY_NODE);
  }

  async work() {
    if (this.lastConfirmedBlock == this.lastExportedBlock) {
      // We are up to date with the blockchain (aka 'current mode'). Sleep longer after finishing this loop.
      this.sleepTimeMsec = constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;

      // On the previous cycle we closed the gap to the head of the blockchain.
      // Check if there are new blocks now.
      const newConfirmedBlock = await this.web3.eth.getBlockNumber() - constants.CONFIRMATIONS
      if (newConfirmedBlock == this.lastConfirmedBlock) {
        // The Node has not progressed
        return []
      }
      this.lastConfirmedBlock = newConfirmedBlock
    }
    else {
      // We are still catching with the blockchain (aka 'historic mode'). Do not sleep after this loop.
      this.sleepTimeMsec = 0
    }

    const toBlock = Math.min(this.lastExportedBlock + constants.BLOCK_INTERVAL, this.lastConfirmedBlock)
    const fromBlock = this.lastExportedBlock + 1

    logger.info(`Fetching transfer events for interval ${fromBlock}:${toBlock}`)

    const events = await getPastEvents(this.web3, fromBlock, toBlock)

    if (events.length > 0) {
      extendEventsWithPrimaryKey(events)
      logger.info(`Setting primary keys ${events.length} messages for blocks ${this.lastExportedBlock + 1}:${toBlock}`)
      this.lastPrimaryKey = events[events.length - 1].primaryKey
    }

    this.lastExportTime = Date.now()
    this.lastExportedBlock = toBlock
    return events;

  }

  async init(exporter) {
    this.lastConfirmedBlock = await this.web3.eth.getBlockNumber() - constants.CONFIRMATIONS
    setGlobalTimestampManager(exporter)
  }
}

module.exports = {
  worker: MaticWorker
}
