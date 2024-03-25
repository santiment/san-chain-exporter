const { Web3 } = require('web3');
const { logger } = require('../../lib/logger');
const { constructRPCClient } = require('../../lib/http_client');
const BaseWorker = require('../../lib/worker_base');
const Web3Wrapper = require('../eth/lib/web3_wrapper');
const { extendEventsWithPrimaryKey } = require('../erc20/lib/extend_events_key');
const { getPastEvents } = require('./lib/fetch_events');
const {
  nextIntervalCalculator,
  analyzeWorkerContext,
  setWorkerSleepTime,
  NO_WORK_SLEEP } = require('../eth/lib/next_interval_calculator');


class MaticWorker extends BaseWorker {
  constructor(settings) {
    super(settings);

    logger.info(`Connecting to Polygon node ${settings.NODE_URL}`);
    this.web3Wrapper = new Web3Wrapper(new Web3(new Web3.providers.HttpProvider(settings.NODE_URL)));
    this.ethClient = constructRPCClient(settings.NODE_URL);
  }

  async work() {
    const workerContext = await analyzeWorkerContext(this);
    setWorkerSleepTime(this, workerContext);
    if (workerContext === NO_WORK_SLEEP) return [];

    const result = nextIntervalCalculator(
      this.lastExportedBlock,
      this.lastConfirmedBlock,
      this.settings.BLOCK_INTERVAL);

    logger.info(`Fetching transfer events for interval ${result.fromBlock}:${result.toBlock}`);

    const events = await getPastEvents(this.ethClient, this.web3Wrapper, result.fromBlock, result.toBlock);

    if (events.length > 0) {
      extendEventsWithPrimaryKey(events);
      logger.info(`Setting primary keys ${events.length} messages for blocks ${result.fromBlock}:${result.toBlock}`);
      this.lastPrimaryKey = events[events.length - 1].primaryKey;
    }

    this.lastExportedBlock = result.toBlock;
    return events;

  }

  async init() {
    this.lastConfirmedBlock = await this.web3Wrapper.getBlockNumber() - this.settings.CONFIRMATIONS;
  }
}

module.exports = {
  worker: MaticWorker
};
