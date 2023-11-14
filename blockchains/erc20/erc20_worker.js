'use strict';
const Web3 = require('web3');
const constants = require('./lib/constants');
const { logger } = require('../../lib/logger');
const { extendEventsWithPrimaryKey } = require('./lib/extend_events_key');
const { ContractOverwrite, editAddressAndAmount, extractChangedContractAddresses } = require('./lib/contract_overwrite');
const { stableSort, readJsonFile } = require('./lib/util');
const BaseWorker = require('../../lib/worker_base');
const { nextIntervalCalculator } = require('../eth/lib/next_interval_calculator');
const { TimestampsCache } = require('./lib/timestamps_cache');
const { getPastEvents } = require('./lib/fetch_events');
const { initBlocksList } = require('../../lib/fetch_blocks_list');



class ERC20Worker extends BaseWorker {
  constructor() {
    super();

    logger.info(`Connecting to Ethereum node ${constants.NODE_URL}`);
    this.web3 = new Web3(new Web3.providers.HttpProvider(constants.NODE_URL));
    this.contractsOverwriteArray = [];
    this.contractsUnmodified = [];
  }

  async init() {
    this.lastConfirmedBlock = await this.web3.eth.getBlockNumber() - constants.CONFIRMATIONS;

    if (constants.EXPORT_BLOCKS_LIST) {
      this.blocksList = await initBlocksList();
    }
    console.log(JSON.stringify(constants));
    if (constants.CONTRACT_MODE !== 'vanilla') {
      const parsedContracts = await readJsonFile(constants.CONTRACT_MAPPING_FILE_PATH);

      if (parsedContracts.modified_contracts) {
        this.contractsOverwriteArray = parsedContracts.modified_contracts.map((contract) => new ContractOverwrite(contract));
      }
      if (parsedContracts.unmodified_contracts) {
        this.contractsUnmodified = parsedContracts.unmodified_contracts.map((contract) => contract.toLowerCase());
      }

      logger.info(`Running in '${constants.CONTRACT_MODE}' contracts mode', ` +
        `${this.contractsOverwriteArray.length + this.contractsUnmodified.length} contracts will be monitored.`);
      logger.info(`Overwritten contracts are: ${JSON.stringify(this.contractsOverwriteArray)}`);
    }
  }

  getBlocksListInterval() {
    if (this.lastExportedBlock === -1 && this.blocksList.length > 0) {
      return {
        success: true,
        fromBlock: this.blocksList[0][0],
        toBlock: this.blocksList[0][1]
      };
    }
    while (this.blocksList.length > 0 && this.lastExportedBlock >= this.blocksList[0][1]) {
      this.blocksList.shift();
    }
    if (this.blocksList.length === 0) {
      return { success: false };
    }
    return {
      success: true,
      fromBlock: this.blocksList[0][0],
      toBlock: this.blocksList[0][1]
    };
  }

  async work() {
    const result = constants.EXPORT_BLOCKS_LIST ?
      this.getBlocksListInterval() :
      await nextIntervalCalculator(this);

    if (!result.success) {
      return [];
    }

    logger.info(`Fetching transfer events for interval ${result.fromBlock}:${result.toBlock}`);

    let events = [];
    let overwritten_events = [];
    if ('extract_exact_overwrite' === constants.CONTRACT_MODE) {
      const timestampsCache = new TimestampsCache();
      for (const contractOverwrite of this.contractsOverwriteArray) {
        const rawEvents = await getPastEvents(this.web3, result.fromBlock, result.toBlock, contractOverwrite.oldAddresses,
          timestampsCache);
        for (const event of rawEvents) {
          editAddressAndAmount(event, contractOverwrite);
          events.push(...rawEvents);
        }
      }
      for (const contractUnmodified of this.contractsUnmodified) {
        const rawEvents = await getPastEvents(this.web3, result.fromBlock, result.toBlock, contractUnmodified,
          timestampsCache);
        events.push(...rawEvents);
      }
    }
    else {
      events = await getPastEvents(this.web3, result.fromBlock, result.toBlock, null, new TimestampsCache());
      if ('extract_all_append' === constants.CONTRACT_MODE) {
        overwritten_events = extractChangedContractAddresses(events, this.contractsOverwriteArray);
      }
    }

    if (events.length > 0) {
      extendEventsWithPrimaryKey(events, overwritten_events);
      logger.info(`Setting primary keys ${events.length} messages for blocks ${result.fromBlock}:${result.toBlock}`);
      this.lastPrimaryKey = events[events.length - 1].primaryKey;
    }

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
