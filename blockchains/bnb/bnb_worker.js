/*jslint node: true */
"use strict";
const { logger } = require('../../lib/logger')

const fetch_transactions = require('./lib/fetch_transactions')
const {BNBTransactionsFetcher} = require('./lib/bnb_transactions_fetcher')
const { getTransactionsWithKeys } = require('./lib/edit_transactions')
const BaseWorker = require("../../lib/worker_base")
const constants = require("./lib/constants")


// This dynamic import is a workaround for p-queue being 'pure ESM' package.
// https://github.com/sindresorhus/p-queue/issues/143
let PQueue = null;
(async () => {
  PQueue = (await import('p-queue')).default;
})()

/**
 * A helper class to store the number of calls made to the BNB API endpoint. The value is then transferred
 * to the metrics variables.
 */
class MetricsStore {
  constructor() {
    this.count = 0
  }

  increment() {
    this.count += 1
  }

  get() {
    return this.count
  }
}


class BNBWorker extends BaseWorker {
  constructor() {
    super();

    this.newRequestsCount = 0
    this.bnbTransactionsFetcher = null
  }

  /**
   * @override
   */
  async init() {
    this.queue = new PQueue({
      concurrency: constants.MAX_CONNECTION_CONCURRENCY,
      interval: constants.TIMEOUT_BETWEEN_REQUESTS_BURST_MSEC,
      intervalCap: constants.MAX_CONNECTION_CONCURRENCY
    })
  }

  /**
   * @override
   */
  async work() {
    const metrics = new MetricsStore();
    let fetchTransactions = await this.bnbTransactionsFetcher.tryFetchTransactionsNextRange(this.queue, metrics);
    this.newRequestsCount += metrics.get();


    let resultTransactions = []
    if (fetchTransactions.length > 0) {
      fetch_transactions.filterRepeatedTransactions(fetchTransactions);
      // The API returns most recent transactions first. Take block number from the first one.
      this.lastExportedBlock = fetchTransactions[0].blockHeight;

      const mergedTransactions = await fetch_transactions.replaceParentTransactionsWithChildren(this.queue,
        fetchTransactions, metrics)
      resultTransactions = getTransactionsWithKeys(mergedTransactions)

      this.lastExportedBlock = resultTransactions[resultTransactions.length - 1].blockHeight
    }

    this.lastExportTime = Date.now()

    // The upper limit of the load rate is enforced by p-queue.
    // If we have catched up with the chain do an extra sleep to reduce the load on the API further.
    // Also if the result is empty, this must be an error on the previous fetch
    if (this.bnbTransactionsFetcher.isUpToDateWithBlockchain || 0 == resultTransactions.length) {
      this.sleepTimeMsec = 1000 * constants.LOOP_INTERVAL_CURRENT_MODE_SEC
    }
    else {
      this.sleepTimeMsec = 0
    }

    return resultTransactions
  }

  /**
   * @override
   */
  getNewRequestsCount() {
    const count = this.newRequestsCount
    this.newRequestsCount = 0
    return count
  }

  /**
   * @override
   */
  getLastProcessedPosition() {
    return {
      blockNumber: this.lastExportedBlock,
      timestampReached: this.bnbTransactionsFetcher.getIntervalFetchEnd()
    }
  }

  /**
   * Initialize the position from which export should start based on latest stored position in Zookeeper.
   *
   * @override
   */
  initPosition(lastProcessedPosition) {
    if (lastProcessedPosition) {
      logger.info(`Resuming export from position ${JSON.stringify(lastProcessedPosition)}`)
    } else {
      lastProcessedPosition = {
        timestampReached : constants.BNB_CHAIN_START_MSEC,
        blockNumber: 0
      }
      logger.info(`Initialized exporter with initial position ${JSON.stringify(lastProcessedPosition)}`)
    }

    this.bnbTransactionsFetcher = new BNBTransactionsFetcher(lastProcessedPosition.timestampReached)
    this.lastExportedBlock = lastProcessedPosition.blockNumber

    return lastProcessedPosition
  }
}

module.exports = {
  worker: BNBWorker
}
