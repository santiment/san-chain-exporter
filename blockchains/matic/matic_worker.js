const Web3 = require('web3');
const jayson = require('jayson/promise');
const constants = require('./lib/constants');
const { logger } = require('../../lib/logger');
const BaseWorker = require('../../lib/worker_base');
const Web3Wrapper = require('../eth/lib/web3_wrapper');
const { extendEventsWithPrimaryKey } = require('../erc20/lib/extend_events_key');
const { getPastEvents } = require('./lib/fetch_events');
const { nextIntervalCalculator } = require('../eth/lib/next_interval_calculator');


class MaticWorker extends BaseWorker {
  constructor() {
    super();

    logger.info(`Connecting to Polygon node ${constants.NODE_URL}`);
    this.web3 = new Web3(new Web3.providers.HttpProvider(constants.NODE_URL));
    this.web3Wrapper = new Web3Wrapper(this.web3);
    if (constants.NODE_URL.substring(0, 5) === 'https') {
      this.ethClient = jayson.client.https(constants.NODE_URL);
    } else {
      this.ethClient = jayson.client.http(constants.NODE_URL);
    }
  }

  async work() {
    const requestIntervals = await nextIntervalCalculator(this);
    if (requestIntervals.length === 0) return [];

    logger.info(
      `Fetching transfer events for interval ${requestIntervals[0].fromBlock}:` +
      `${requestIntervals[requestIntervals.length - 1].toBlock}`);

    const events = [].concat(...await Promise.all(
      requestIntervals.map(async (requestInterval) => {
        return await getPastEvents(
          this.web3,
          requestInterval.fromBlock,
          requestInterval.toBlock);
        })
      ));

    if (events.length > 0) {
      extendEventsWithPrimaryKey(events);
      logger.info(`Setting primary keys ${events.length} messages for blocks ${requestIntervals[0].fromBlock}:`+
      `${requestIntervals[requestIntervals.length - 1].toBlock}`);
      this.lastPrimaryKey = events[events.length - 1].primaryKey;
    }

    this.lastExportedBlock = requestIntervals[requestIntervals.length - 1].toBlock;
    return events;
  }

  async init() {
    this.lastConfirmedBlock = await this.web3.eth.getBlockNumber() - constants.CONFIRMATIONS;
  }
}

module.exports = {
  worker: MaticWorker
};
