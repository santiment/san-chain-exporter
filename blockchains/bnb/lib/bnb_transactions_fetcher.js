"use strict";
const { logger } = require('../../../lib/logger')
const {getLastBlockTimestamp, getLastTradesBlockTimestamp}  = require('./utils')
const {fetchTimeInterval} = require('./fetch_transactions')
const constants = require("./constants")


/**
 * A class wrapping the tools for fetching transactions. It holds as state the position of the last fetch.
 */
class BNBTransactionsFetcher {
  constructor(lastIntervalFetchEnd, msecInFetchRange, bnbTradesMode = false) {
    // The timestamp of the last block produced. Will be reduced with real value.
    this.lastBlockTimestamp = 0
    /**
     * We start by fetching transactions for an hour. This will be dynamically reduced when the transactions
     * number increase.
     */
    this.msecInFetchRange = msecInFetchRange
    this.intervalFetchStart = 0
    this.intervalFetchEnd = lastIntervalFetchEnd
    this.isUpToDateWithBlockchain = false
    this.bnbTradesMode = bnbTradesMode
  }

  getIntervalFetchEnd() {
    return this.intervalFetchEnd
  }

  getMsecInFetchRange() {
    return this.msecInFetchRange
  }

  // When the exporter catches up with the Node, we need to limit the range of blocks we query
  tryGetNextInterval() {
    let potentialNewStart = this.intervalFetchEnd + 1
    let potentialNewEnd = potentialNewStart + this.msecInFetchRange

    if (potentialNewEnd <= this.lastBlockTimestamp - constants.SAFETY_BLOCK_WAIT_MSEC) {
      return {
        intervalFetchStart: potentialNewStart,
        intervalFetchEnd: potentialNewEnd,
        result: true
      }
    }
    // Return the potential interval for logging purpose
    return {
      intervalFetchStart: potentialNewStart,
      intervalFetchEnd: potentialNewEnd,
      result: false
    }
  }

  async tryGetNextIntervalWithNode(metrics) {
    // If the end interval exceeds the head of the blockchain, check if the blockchain has moved forward since the
    // last value we have locally. We do not check the blockchain head on each call to reduce the load on the API when
    // in 'historic' mode. In that mode we can export a lot of data before reaching the last seen 'head'.
    const nextRange = this.tryGetNextInterval()
    if (nextRange.result) {
      return nextRange
    }

    this.lastBlockTimestamp = this.bnbTradesMode ?
    await getLastTradesBlockTimestamp(metrics)
    :
    await getLastBlockTimestamp(metrics);

    // Check again if the end interval is possible now
    return this.tryGetNextInterval()
  }

  async tryFetchTransactionsNextRange(queue, metrics) {
    const nextRange = await this.tryGetNextIntervalWithNode(metrics)
    this.isUpToDateWithBlockchain = ! nextRange.result
    if (!nextRange.result) {
      // Unable to move forward. Blockchain has not progressed.
      logger.info(`Waiting for blockchain to reach timestamp ${nextRange.intervalFetchEnd} so we can fetch interval`)
      return []
    }

    const nodeResponsePromises = [];
    logger.info(`Fetching transactions for time interval: ${nextRange.intervalFetchStart}-\
${nextRange.intervalFetchEnd}`);
    const fetchScheduleSuccess = await fetchTimeInterval(queue, nextRange.intervalFetchStart,
      nextRange.intervalFetchEnd, nodeResponsePromises, metrics, this.bnbTradesMode)

    if (!fetchScheduleSuccess) {
      logger.info(`Can not fetch time interval. Reducing interval size from ${this.msecInFetchRange} msec to \
${Math.floor(this.msecInFetchRange / 2)} msec`)
      this.msecInFetchRange = Math.floor(this.msecInFetchRange / 2)
      // The data is compromised, nothing would be written on this iteration
      return []
    }

    const trxResults = [];
    try {
      logger.info(`Waiting for the pages of the time interval to be fetched from BNB Node. \
${nodeResponsePromises.length - 1} requests.`)
      const blockResults = await Promise.all(nodeResponsePromises);
      for (let blockResultsIndex = 0; blockResultsIndex < blockResults.length; ++blockResultsIndex) {
        if (this.bnbTradesMode) {
          trxResults.push(...blockResults[blockResultsIndex].trade)
        }
        else {
          trxResults.push(...blockResults[blockResultsIndex].txArray)
        }
      }

      logger.info(`${trxResults.length} transactions fetched.`)
    }
    catch (exception) {
      logger.error(exception.message);
      return []
    }

    // No errors, commit the fetch range
    this.intervalFetchStart = nextRange.intervalFetchStart
    this.intervalFetchEnd = nextRange.intervalFetchEnd
    return trxResults
  }
}


module.exports = {
  BNBTransactionsFetcher
}
