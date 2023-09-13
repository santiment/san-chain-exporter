'use strict';
const Web3 = require('web3');
const constants = require('./lib/constants');
const { logger } = require('../../lib/logger');
const { extendEventsWithPrimaryKey } = require('./lib/extend_events_key');

let contractEditor = null;
if (constants.CONTRACT_MODE !== 'vanilla') { contractEditor = require('./lib/contract_overwrite').contractEditor; }

const { stableSort } = require('./lib/util');
const BaseWorker = require('../../lib/worker_base');
const { nextIntervalCalculator } = require('../eth/lib/next_interval_calculator');
const { getPastEvents, setGlobalTimestampManager } = require('./lib/fetch_events');
const { initBlocksList, initBlocksListPosition } = require('../../lib/fetch_blocks_list');


class ERC20Worker extends BaseWorker {
  constructor() {
    super();

    logger.info(`Connecting to Ethereum node ${constants.NODE_URL}`);
    this.web3 = new Web3(new Web3.providers.HttpProvider(constants.NODE_URL));
  }

  async init(exporter) {
    this.lastConfirmedBlock = await this.web3.eth.getBlockNumber() - constants.CONFIRMATIONS;
    setGlobalTimestampManager(exporter);

    if (constants.EXPORT_BLOCKS_LIST) {
      this.blocksList = await initBlocksList();
    }
  }

  async initPosition(lastProcessedPosition) {
    if (constants.EXPORT_BLOCKS_LIST) {
      this.blocksListPosition = initBlocksListPosition(lastProcessedPosition, this.blocksList);
      this.lastExportedBlock = this.blocksList[this.blocksListPosition][0];
      this.lastPrimaryKey = parseInt(process.env.START_PRIMARY_KEY || '-1');
    } else {
      return super.initPosition(lastProcessedPosition);
    }
  }

  checkBlocksListPosition() {
    if (this.blocksListPosition < this.blocksList.length) {
      return {
        success: true,
        fromBlock: this.blocksList[this.blocksListPosition][0],
        toBlock: this.blocksList[this.blocksListPosition][1]
      };
    }
    return { success: false };
  }

  async work() {
    const result = constants.EXPORT_BLOCKS_LIST ?
      this.checkBlocksListPosition() :
      await nextIntervalCalculator(this);

    if (!result.success) {
      return [];
    }

    logger.info(`Fetching transfer events for interval ${result.fromBlock}:${result.toBlock}`);

    let events;
    let overwritten_events = [];
    if ('extract_exact_overwrite' === constants.CONTRACT_MODE) {
      events = await contractEditor.getPastEventsExactContracts(this.web3, result.fromBlock, result.toBlock);
      contractEditor.changeContractAddresses(events);
    }
    else {
      events = await getPastEvents(this.web3, result.fromBlock, result.toBlock);
      if ('extract_all_append' === constants.CONTRACT_MODE) {
        overwritten_events = contractEditor.extractChangedContractAddresses(events);
      }
    }

    if (events.length > 0) {
      extendEventsWithPrimaryKey(events, overwritten_events);
      logger.info(`Setting primary keys ${events.length} messages for blocks ${result.fromBlock}:${result.toBlock}`);
      this.lastPrimaryKey = events[events.length - 1].primaryKey;
    }

    if (constants.EXPORT_BLOCKS_LIST) this.blocksListPosition++;
    this.lastExportedBlock = result.toBlock;
    const resultEvents = events.concat(overwritten_events);

    // If overwritten events have been generated, they need to be merged into the original events
    if (overwritten_events.length > 0) {
      stableSort(resultEvents, function primaryKeyOrder(a, b) {
        return a.primaryKey - b.primaryKey;
      });
    }

    return resultEvents;
  }
}

module.exports = {
  worker: ERC20Worker
};
