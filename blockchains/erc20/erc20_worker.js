"use strict";
const Web3 = require('web3')
const { logger } = require('../../lib/logger')
const constants = require('./lib/constants')
const { extendEventsWithPrimaryKey } = require('./lib/extend_events_key')
let contractEditor = null
if (constants.CONTRACT_MODE != "vanilla") {
  contractEditor = require('./lib/contract_overwrite').contractEditor
}
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
        return []
      }
      this.lastConfirmedBlock = newConfirmedBlock
    }
    else {
      // We are still catching with the blockchain (aka 'historic mode'). Do not sleep after this loop.
      this.sleepTimeMsec = 0
    }

    const toBlock = Math.min(this.lastExportedBlock + constants.BLOCK_INTERVAL, this.lastConfirmedBlock)
    logger.info(`Fetching transfer events for interval ${this.lastExportedBlock}:${toBlock}`)

    let events = [];
    let overwritten_events = []
    if ("extract_exact_overwrite" == constants.CONTRACT_MODE) {
      events = await contractEditor.getPastEventsExactContracts(this.web3, this.lastExportedBlock + 1, toBlock)
      contractEditor.changeContractAddresses(events)
    }
    else {
      events = await getPastEvents(this.web3, this.lastExportedBlock + 1, toBlock)
      if ("extract_all_append" == constants.CONTRACT_MODE) {
        overwritten_events = contractEditor.extractChangedContractAddresses(events)
      }
    }

    if (events.length > 0) {
      extendEventsWithPrimaryKey(events, overwritten_events)
      logger.info(`Setting primary keys ${events.length} messages for blocks ${this.lastExportedBlock + 1}:${toBlock}`)
      this.lastPrimaryKey = events[events.length - 1].primaryKey
    }

    this.lastExportTime = Date.now()
    this.lastExportedBlock = toBlock
    return events.concat(overwritten_events)
  }
}

module.exports = {
  worker: ERC20Worker
}
