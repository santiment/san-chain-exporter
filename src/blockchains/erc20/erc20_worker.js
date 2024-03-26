'use strict';
const { Web3 } = require('web3');
const { logger } = require('../../lib/logger');
const { constructRPCClient } = require('../../lib/http_client');
const { extendEventsWithPrimaryKey } = require('./lib/extend_events_key');
const { ContractOverwrite, changeContractAddresses, extractChangedContractAddresses } = require('./lib/contract_overwrite');
const { stableSort, readJsonFile } = require('./lib/util');
const BaseWorker = require('../../lib/worker_base');
const { nextIntervalCalculator, setWorkerSleepTime, analyzeWorkerContext, NO_WORK_SLEEP } = require('../eth/lib/next_interval_calculator');
const Web3Wrapper = require('../eth/lib/web3_wrapper');
const { TimestampsCache } = require('./lib/timestamps_cache');
const { getPastEvents } = require('./lib/fetch_events');
const { initBlocksList } = require('../../lib/fetch_blocks_list');

/**
 * A simple non cryptographic hash function similar to Java's 'hashCode'
 * @param {string} input A string input
 * @returns {number} A 32 bit positive integer
 */
function simpleHash(input) {
  var hash = 0, i, chr;

  if (input.length === 0) return hash;

  for (i = 0; i < input.length; i++) {
    chr = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

class ERC20Worker extends BaseWorker {
  constructor(settings, web3Wrapper, ethClient) {
    super(settings);

    logger.info(`Connecting to Ethereum node ${settings.NODE_URL}`);
    logger.info(`Applying the following settings: ${JSON.stringify(settings)}`);
    this.web3Wrapper = web3Wrapper || new Web3Wrapper(new Web3(new Web3.providers.HttpProvider(settings.NODE_URL)));
    if (!ethClient) {
      this.ethClient = constructRPCClient(settings.NODE_URL);
      this.contractsOverwriteArray = [];
      this.contractsUnmodified = [];
      this.allOldContracts = [];
    }
    else {
      this.ethClient = ethClient;
    }
  }

  async init(exporter) {
    this.lastConfirmedBlock = await this.web3Wrapper.getBlockNumber() - this.settings.CONFIRMATIONS;

    if (this.settings.EXPORT_BLOCKS_LIST) {
      this.blocksList = await initBlocksList();
    }

    if (this.settings.CONTRACT_MODE !== 'vanilla') {
      const parsedContracts = await readJsonFile(this.settings.CONTRACT_MAPPING_FILE_PATH);

      if (parsedContracts.modified_contracts) {
        this.contractsOverwriteArray = parsedContracts.modified_contracts.map((contract) => new ContractOverwrite(contract));
        this.allOldContracts = this.contractsOverwriteArray.flatMap(obj => obj.oldAddresses);
      }
      if (parsedContracts.unmodified_contracts) {
        this.contractsUnmodified = parsedContracts.unmodified_contracts.map((contract) => contract.toLowerCase());
      }

      logger.info(`Running in '${this.settings.CONTRACT_MODE}' contracts mode', ` +
        `${this.contractsOverwriteArray.length + this.contractsUnmodified.length} contracts will be monitored.`);
      logger.info(`Overwritten contracts are: ${JSON.stringify(this.contractsOverwriteArray)}`);
      logger.info(`Extracted unmodified contracts are: ${JSON.stringify(this.contractsUnmodified)}`);
    }

    if (this.settings.EVENTS_IN_SAME_PARTITION) {
      await exporter.initPartitioner((event) => simpleHash(event.contract));
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
    const workerContext = await analyzeWorkerContext(this);
    setWorkerSleepTime(this, workerContext);
    if (workerContext === NO_WORK_SLEEP) return [];

    const interval = this.settings.EXPORT_BLOCKS_LIST ?
      this.getBlocksListInterval() :
      nextIntervalCalculator(
        this.lastExportedBlock,
        this.lastConfirmedBlock,
        this.settings.BLOCK_INTERVAL);

    logger.info(`Fetching transfer events for interval ${interval.fromBlock}:${interval.toBlock}`);

    let events = [];
    let overwritten_events = [];
    const timestampsCache = new TimestampsCache(this.ethClient, this.web3Wrapper, interval.fromBlock, interval.toBlock);
    if ('extract_exact_overwrite' === this.settings.CONTRACT_MODE) {
      if (this.allOldContracts.length > 0) {
        events = await getPastEvents(this.web3Wrapper, interval.fromBlock, interval.toBlock, this.allOldContracts, timestampsCache);
        changeContractAddresses(events, this.contractsOverwriteArray);
      }

      if (this.contractsUnmodified.length > 0) {
        const rawEvents = await getPastEvents(this.web3Wrapper, interval.fromBlock, interval.toBlock, this.contractsUnmodified,
          timestampsCache);

        for (const event of rawEvents) {
          events.push(event);
        }
      }
    }
    else {
      events = await getPastEvents(this.web3Wrapper, interval.fromBlock, interval.toBlock, null, timestampsCache);
      if ('extract_all_append' === this.settings.CONTRACT_MODE) {
        overwritten_events = extractChangedContractAddresses(events, this.contractsOverwriteArray);
      }
    }

    if (events.length > 0) {
      extendEventsWithPrimaryKey(events, this.settings.PRIMARY_KEY_MULTIPLIER, overwritten_events);
      logger.info(`Setting primary keys ${events.length} messages for blocks ${interval.fromBlock}:${interval.toBlock}`);
      this.lastPrimaryKey = events[events.length - 1].primaryKey;
    }

    this.lastExportedBlock = interval.toBlock;
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
