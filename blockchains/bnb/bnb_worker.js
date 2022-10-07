/*jslint node: true */
'use strict';
const { logger } = require('../../lib/logger');

const fetch_transactions = require('./lib/fetch_transactions');
const { BNBTransactionsFetcher } = require('./lib/bnb_transactions_fetcher');
const { getTransactionsWithKeys } = require('./lib/edit_transactions');
const BaseWorker = require('../../lib/worker_base');
const constants = require('./lib/constants');


// This dynamic import is a workaround for p-queue being 'pure ESM' package.
// https://github.com/sindresorhus/p-queue/issues/143
let PQueue = null;
(async () => {
  PQueue = (await import('p-queue')).default;
})();

/**
 * A helper class to store the number of calls made to the BNB API endpoint. The value is then transferred
 * to the metrics variables.
 */
class MetricsStore {
  constructor() {
    this.count = 0;
  }

  increment() {
    this.count += 1;
  }

  get() {
    return this.count;
  }
}


class BNBWorker extends BaseWorker {
  constructor() {
    super();

    this.newRequestsCount = 0;
    this.bnbTransactionsFetcher = null;

    if (constants.BNB_MODE !== 'trades' && constants.BNB_MODE !== 'transactions') {
      throw new Error(`BNB mode needs to be either 'transactions' or 'trades' provided is '${constants.BNB_MODE}'`);
    }
    this.bnbTradesMode = constants.BNB_MODE === 'trades';

    logger.info(`BNBWorker running in '${constants.BNB_MODE}' mode. Node URL is: '${constants.SERVER_URL}'`);
  }

  /**
   * @override
   */
  async init() {
    this.queue = new PQueue({
      concurrency: constants.MAX_CONNECTION_CONCURRENCY,
      interval: constants.TIMEOUT_BETWEEN_REQUESTS_BURST_MSEC,
      intervalCap: constants.MAX_CONNECTION_CONCURRENCY
    });
  }

  /**
   * @override
   */
  async work() {
    const metrics = new MetricsStore();
    let fetchTransactions = await this.bnbTransactionsFetcher.tryFetchTransactionsNextRange(this.queue, metrics);
    this.newRequestsCount += metrics.get();


    let resultTransactions = [];
    if (fetchTransactions.length > 0) {
      if (this.bnbTradesMode) {
        fetch_transactions.filterRepeatedTrade(fetchTransactions);
      }
      else {
        fetch_transactions.filterRepeatedTransactions(fetchTransactions);
      }

      // The API returns most recent transactions first. Take block number from the first one.
      this.lastExportedBlock = fetchTransactions[0].blockHeight;

      if (!this.bnbTradesMode) {
        fetchTransactions = await fetch_transactions.replaceParentTransactionsWithChildren(this.queue,
          fetchTransactions, metrics);
      }

      resultTransactions = getTransactionsWithKeys(fetchTransactions);

      this.lastExportedBlock = resultTransactions[resultTransactions.length - 1].blockHeight;
    }

    this.lastExportTime = Date.now();

    // The upper limit of the load rate is enforced by p-queue.
    // If we have catched up with the chain do an extra sleep to reduce the load on the API further.
    // Also if the result is empty, this must be an error on the previous fetch
    if (this.bnbTransactionsFetcher.isUpToDateWithBlockchain || resultTransactions.length === 0) {
      this.sleepTimeMsec = 1000 * constants.LOOP_INTERVAL_CURRENT_MODE_SEC;
    }
    else {
      this.sleepTimeMsec = 0;
    }

    return resultTransactions;
  }

  /**
   * @override
   */
  getNewRequestsCount() {
    const count = this.newRequestsCount;
    this.newRequestsCount = 0;
    return count;
  }

  /**
   * @override
   */
  getLastProcessedPosition() {
    return {
      blockNumber: this.lastExportedBlock,
      timestampReached: this.bnbTransactionsFetcher.getIntervalFetchEnd(),
      fetchRangeMsec: this.bnbTransactionsFetcher.getMsecInFetchRange()
    };
  }

  /**
   * Initialize the position from which export should start based on latest stored position in Zookeeper.
   *
   * @override
   */
  initPosition(lastProcessedPosition) {
    let fetchRangeMsec = constants.FETCH_INTERVAL_CURRENT_MODE_MSEC;
    if (lastProcessedPosition) {
      logger.info(`Resuming export from position ${JSON.stringify(lastProcessedPosition)}`);
      // If the last range used is bigger than 'current' mode - use it
      if (lastProcessedPosition.fetchRangeMsec > constants.FETCH_INTERVAL_CURRENT_MODE_MSEC) {
        fetchRangeMsec = lastProcessedPosition.fetchRangeMsec;
      }
    } else {
      // This is a new deploy, we would try the big historic fetch interval
      fetchRangeMsec = constants.FETCH_INTERVAL_HISTORIC_MODE_MSEC;
      lastProcessedPosition = {
        timestampReached: constants.BNB_CHAIN_START_MSEC,
        blockNumber: 0
      };
      logger.info(`Initialized exporter with initial position ${JSON.stringify(lastProcessedPosition)}`);
    }

    lastProcessedPosition.fetchRangeMsec = fetchRangeMsec;

    this.bnbTransactionsFetcher = new BNBTransactionsFetcher(lastProcessedPosition.timestampReached, fetchRangeMsec,
      this.bnbTradesMode);
    this.lastExportedBlock = lastProcessedPosition.blockNumber;

    return lastProcessedPosition;
  }
}

module.exports = {
  worker: BNBWorker
};
