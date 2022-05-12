/*jslint node: true */
"use strict";

//import PQueue from 'p-queue';
const fetch_transactions = require('./lib/fetch_transactions')
const { getTransactionsWithKeys } = require('./lib/edit_transactions')
const BaseWorker = require("../../lib/worker_base")

const MAX_CONNECTION_CONCURRENCY = parseInt(process.env.MAX_CONNECTION_CONCURRENCY || "5");
const TIMEOUT_BETWEEN_REQUESTS_BURST_MSEC = parseInt(process.env.TIMEOUT_BETWEEN_REQUESTS_BURST_MSEC || "2000");
const BNB_CHAIN_START_MSEC = parseInt(process.env.BNB_CHAIN_START_MSEC || "1555545600000");

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

    this.queue = new PQueue({
      concurrency: MAX_CONNECTION_CONCURRENCY,
      interval: TIMEOUT_BETWEEN_REQUESTS_BURST_MSEC,
      intervalCap: MAX_CONNECTION_CONCURRENCY
    });

  }

  async init() {
    this.timestampReached = BNB_CHAIN_START_MSEC
    this.newRequestsCount = 0
  }

  async work() {
    const metrics = new MetricsStore()
    const fetchResult = await fetch_transactions.fetchTransactions(this.queue, this.timestampReached, metrics)
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
      // Use the available timeouts we have to devise some sleep interval.
      // Not some great idea of why exactly this. Want the interval to be dynamic but still upper bound.
      this.sleepTimeMsec = Math.min(fetchResult.lastFetchRangeMsec, fetch_transactions.SAFETY_BLOCK_WAIT_MSEC)
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
