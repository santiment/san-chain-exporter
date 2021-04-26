"use strict";
const Web3 = require('web3')
const { logger } = require('../../lib/logger')
const constants = require('./lib/constants')
const { extendEventsWithPrimaryKey } = require('./lib/extend_events_key')
const { getPastEventsExactContracts } = require('./lib/contract_overwrite')
const { getPastEvents } = require('./lib/fetch_events')
const BaseWorker = require('../../lib/worker_base')


class ERC20Worker extends BaseWorker {
  constructor() {
    super()

    logger.info(`Connecting to parity node ${constants.PARITY_NODE}`)
    this.web3 = new Web3(new Web3.providers.HttpProvider(constants.PARITY_NODE))
  }

  async init() {
    this.lastConfirmedBlock = await this.web3.eth.getBlockNumber() - constants.CONFIRMATIONS
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
        return
      }
      this.lastConfirmedBlock = newConfirmedBlock
    }
    else {
      // We are still catching with the blockchain (aka 'historic mode'). Do not sleep after this loop.
      this.sleepTimeMsec = 0
    }

    const toBlock = Math.min(this.lastExportedBlock + constants.BLOCK_INTERVAL, this.lastConfirmedBlock)
    logger.info(`Fetching transfer events for interval ${this.lastExportedBlock}:${toBlock}`)
    this.lastRequestStartTime = new Date();

    let events = [];
    if (constants.EXACT_CONTRACT_MODE) {
      events = await getPastEventsExactContracts(this.web3, this.lastExportedBlock + 1, toBlock);
    }
    else {
      events = await getPastEvents(this.web3, this.lastExportedBlock + 1, toBlock);
    }

    if (events.length > 0) {
      extendEventsWithPrimaryKey(events)
      logger.info(`Setting primary keys ${events.length} messages for blocks ${this.lastExportedBlock + 1}:${toBlock}`)
      this.lastPrimaryKey = events[events.length - 1].primaryKey
    }

    this.lastExportTime = Date.now()
    this.lastExportedBlock = toBlock
    return events;
  }

  healthcheckExportTimeout() {
    const timeFromLastExport = Date.now() - this.lastExportTime
    const isExportTimeoutExceeded = timeFromLastExport > constants.EXPORT_TIMEOUT_MLS
    if (isExportTimeoutExceeded) {
      return Promise.reject(`Time from the last export ${timeFromLastExport}ms exceeded limit  ${constants.EXPORT_TIMEOUT_MLS}ms.`)
    } else {
      return Promise.resolve()
    }
  }

  healthcheck() {
    return this.web3.eth.getBlockNumber()
    .then(healthcheckExportTimeout())
  }
}

module.exports = {
  ERC20Worker
}
