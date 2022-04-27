/*jslint node: true */
"use strict";

const fetch_transactions = require('./lib/fetch_transactions')
const { getTransactionsWithKeys } = require('./lib/edit_transactions')
const PQueue = import('p-queue');
const BaseWorker = require("../../lib/worker_base")

const MAX_CONNECTION_CONCURRENCY = parseInt(process.env.MAX_CONNECTION_CONCURRENCY || "5");
const TIMEOUT_BETWEEN_REQUESTS_BURST_MSEC = parseInt(process.env.TIMEOUT_BETWEEN_REQUESTS_BURST_MSEC || "2000");
const BNB_CHAIN_START_MSEC = parseInt(process.env.BNB_CHAIN_START_MSEC || "1555545600000");

class BNBWorker extends BaseWorker {
  constructor() {
    super()
    this.queue = new PQueue({
      concurrency: MAX_CONNECTION_CONCURRENCY,
      interval: TIMEOUT_BETWEEN_REQUESTS_BURST_MSEC,
      intervalCap: MAX_CONNECTION_CONCURRENCY
    })
    this.timestampReached = BNB_CHAIN_START_MSEC
  }

  async init(exporter, metrics) {
    this.metrics = metrics
  }

  async work() {
    const fetchResult = await fetch_transactions.fetchTransactions(this.queue, this.timestampReached)

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
      }

      this.lastExportTime = Date.now()
      this.lastExportedBlock = resultTransactions[resultTransactions.length - 1].block.number
      this.lastPrimaryKey += resultTransactions.length
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

  fillLastProcessedPosition(lastProcessedPosition) {
    super.fillLastProcessedPosition(lastProcessedPosition)
    lastProcessedPosition.timestampReached = this.timestampReached
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
