/*jslint node: true */
"use strict";

//import PQueue from 'p-queue';
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

    this.timestampReached = constants.BNB_CHAIN_START_MSEC
    this.newRequestsCount = 0
    this.bnbTransactionsFetcher = new BNBTransactionsFetcher()
  }

  async init() {
    this.queue = new PQueue({
      concurrency: constants.MAX_CONNECTION_CONCURRENCY,
      interval: constants.TIMEOUT_BETWEEN_REQUESTS_BURST_MSEC,
      intervalCap: constants.MAX_CONNECTION_CONCURRENCY
    })
  }

  async work() {
    const metrics = new MetricsStore()
    const fetchResult = await this.bnbTransactionsFetcher.fetchTransactions(this.queue, this.timestampReached, metrics)
    this.newRequestsCount += metrics.get()

    let resultTransactions = []
    if (true === fetchResult.success) {
      if (fetchResult.transactions.length > 0) {
        fetch_transactions.filterRepeatedTransactions(fetchResult.transactions);
        // The API returns most recent transactions first. Take block number from the first one.
        this.lastExportedBlock = fetchResult.transactions[0].blockHeight;

        const mergedTransactions = await fetch_transactions.replaceParentTransactionsWithChildren(this.queue,
          fetchResult.transactions)
        //logger.info(`Storing: ${mergedTransactions.length} transactions to Kafka.`)
        resultTransactions = getTransactionsWithKeys(mergedTransactions)

        this.lastExportedBlock = resultTransactions[resultTransactions.length - 1].blockHeight
        this.lastPrimaryKey += resultTransactions.length
      }

      if (fetchResult.intervalFetchEnd > this.timestampReached) {
        this.timestampReached = fetchResult.intervalFetchEnd;
      }

      this.lastExportTime = Date.now()
    }

    // The upper limit of the load rate is enforced by p-queue.
    // If we have catched up with the chain do an extra sleep to reduce the load on the API further.
    if (this.timestampReached + fetchResult.lastFetchRangeMsec +
      fetch_transactions.SAFETY_BLOCK_WAIT_MSEC > fetchResult.lastBlockTimestamp ) {
      this.sleepTimeMsec = Math.min(constants.LOOP_INTERVAL_CURRENT_MODE_SEC)
    }

    return resultTransactions
  }

  getNewRequestsCount() {
    const count = this.newRequestsCount
    this.newRequestsCount = 0
    return count
  }

  getLastProcessedPosition() {
    return {
      blockNumber: this.lastExportedBlock,
      timestampReached: this.timestampReached
    }
  }

  /**
   * Initialize the position from which export should start based on latest stored position in Zookeeper.
   */
  initPosition(lastProcessedPosition) {
    super.initPosition(lastProcessedPosition)
    this.timestampReached = lastProcessedPosition.timestampReached
  }
}

module.exports = {
  worker: BNBWorker
}
