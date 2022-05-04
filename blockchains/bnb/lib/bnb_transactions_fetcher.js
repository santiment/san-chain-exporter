"use strict";
const { logger } = require('../../../lib/logger')
const {getLastBlockTimestamp} = require('./utils')
const {fetchTimeInterval} = require('./fetch_transactions')
const constants = require("./constants")


/**
 * A class wrapping the tools for fetching transactions. It holds as state the position of the last fetch.
 */
class BNBTransactionsFetcher {
  constructor() {
    // The timestamp of the last block produced. Will be reduced with real value.
    this.lastBlockTimestamp = 0
    /**
     * We start by fetching transactions for an hour. This will be dynamically reduced when the transactions
     * number increase.
     */
    this.msecInFetchRange = constants.FETCH_INTERVAL_HISTORIC_MODE_MSEC
    this.intervalFetchEnd = 0
  }

  async updateIntervalFetchEnd(intervalFetchStart, metrics) {
    let potentialNewEnd = intervalFetchStart + this.msecInFetchRange;

    // When the exporter catches up with the Node, we need to limit the range of blocks we query
    if (potentialNewEnd > this.lastBlockTimestamp - constants.SAFETY_BLOCK_WAIT_MSEC) {
      this.lastBlockTimestamp = await getLastBlockTimestamp(metrics);
      // Check again if the end interval is correct against the updated last block timestamp
      if (potentialNewEnd > this.lastBlockTimestamp - constants.SAFETY_BLOCK_WAIT_MSEC) {
        potentialNewEnd = this.lastBlockTimestamp - constants.SAFETY_BLOCK_WAIT_MSEC;
      }
    }

    if (potentialNewEnd > intervalFetchStart) {
      this.intervalFetchEnd = potentialNewEnd
      this.msecInFetchRange = this.intervalFetchEnd - intervalFetchStart
      return true
    }

    return false
  }

  async fetchTransactions(queue, timestampReached, metrics) {
    const intervalFetchStart = timestampReached + 1;

    if( false == await this.updateIntervalFetchEnd(intervalFetchStart, metrics)) {
      // Unable to move forward. Blockchain has not progressed.
      return { "success": false };
    }

    const nodeResponsePromises = [];
    logger.info(`Fetching transactions for time interval: ${intervalFetchStart}-${this.intervalFetchEnd}`);
    const fetchScheduleSuccess = await fetchTimeInterval(queue, intervalFetchStart, this.intervalFetchEnd,
      nodeResponsePromises, metrics);

    if (!fetchScheduleSuccess) {
      logger.info(`Can not fetch time interval. Reducing interval size from ${this.msecInFetchRange} msec to \
${this.msecInFetchRange / 2} msec`);
      this.msecInFetchRange = Math.floor(this.msecInFetchRange / 2)
      // The data is compromised, nothing would be written on this iteration
      return { "success": false }
    }

    const trxResults = [];
    try {
      logger.info(`Waiting for the pages of the time interval to be fetched from BNB Node. \
${nodeResponsePromises.length - 1} requests.`)
      const blockResults = await Promise.all(nodeResponsePromises);
      for (let blockResultsIndex = 0; blockResultsIndex < blockResults.length; ++blockResultsIndex) {
        trxResults.push(...blockResults[blockResultsIndex].txArray);
      }
      logger.info(`${trxResults.length} transactions fetched.`)
    }
    catch (exception) {
      logger.error(exception);
      return { "success": false };
    }

    return { "transactions": trxResults, "intervalFetchEnd": this.intervalFetchEnd,
      "lastFetchRangeMsec": this.msecInFetchRange, "lastBlockTimestamp": this.lastBlockTimestamp, "success": true
    };
  }
}


module.exports = {
  BNBTransactionsFetcher
}
