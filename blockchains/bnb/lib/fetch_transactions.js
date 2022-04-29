"use strict";
const { logger } = require('../../../lib/logger')
const utils = require('./utils')


global.SERVER_URL = process.env.NODE_URL || "https://explorer.binance.org/api/v1/";
// Hint for ESlint
/* global SERVER_URL */

// The biggest page we can ask the BNB API for. We should query a time interval small enough, so that it results fit in this number of pages.
const BNB_API_MAX_PAGE = parseInt(process.env.BNB_API_MAX_PAGE || "100");
// The maximum number of rows that can be requested according to the BNB API. The value is different depending on the request.
const MAX_NUM_ROWS_TIME_INTERVAL = 100;
// Stay number of msecs behind the chain head in case of forks
const SAFETY_BLOCK_WAIT_MSEC = 100000;
// We start by fetching transactions for an hour. This will be dynamically reduced when the transactions number increase.
const FETCH_INTERVAL_HISTORIC_MODE_MSEC =  parseInt(process.env.FETCH_INTERVAL_HISTORIC_MODE_MSEC || "3600000");


function sendTimeIntervalQuery(startTimeMsec, endTimeMsec, pageIndex, queue, metrics) {
  return queue.add(async () => {
    const queryString = {
      page: pageIndex,
      rows: MAX_NUM_ROWS_TIME_INTERVAL,
      startTime: startTimeMsec,
      endTime: endTimeMsec
    };
    const serverUri = SERVER_URL + "txs";

    return await utils.sendRequest(queryString, serverUri, metrics);
  });
}

function sendTrxQuery(trxId, queue, metrics) {
  return queue.add(async () => {
    const queryString = {
       txHash: trxId
    };
    const serverUri = SERVER_URL + "tx";

    return await utils.sendRequest(queryString, serverUri, metrics);
  });
}

async function fetchTimeInterval(queue, startTimeMsec, endTimeMsec, nodeResponsePromises, metrics) {
  // On the first iteration update with the exact number
  let pagesToIterate = BNB_API_MAX_PAGE;
  for (let pageIndex = 1; pageIndex <= pagesToIterate; ++pageIndex) {
    let promiseResult = sendTimeIntervalQuery(startTimeMsec, endTimeMsec, pageIndex, queue, metrics);

    if (1 === pageIndex) {
      // On the first request, check how many pages we would need to get
      const firstPageResult = await promiseResult;

      if (typeof firstPageResult === 'undefined' || firstPageResult.txArray === 'undefined') {
        throw ("Error in fetch interval ", startTimeMsec, " - ", endTimeMsec);
      }

      pagesToIterate = Math.ceil(firstPageResult.txNums / MAX_NUM_ROWS_TIME_INTERVAL);

      let intervalString = `${startTimeMsec}-${endTimeMsec}`
      logger.info(`Interval ${intervalString} has ${pagesToIterate} pages`);

      if (pagesToIterate > BNB_API_MAX_PAGE) {
        // There are too many transactions in this time interval. The only way to proceed is reduce the time interval.
        // Abort all currently collected and come back with smaller interval.
        logger.info(`Interval ${intervalString} has too many transactions. Reducing interval.`);
        return false;
      }

      // Store the result of this page along with the others
      promiseResult = Promise.resolve(firstPageResult);

    }
    nodeResponsePromises.push(promiseResult);
  }

  return true;
}

async function fetchTransactionWithChildren(queue, parentTrx, subTrxMap, metrics) {
  // On the first iteration update with the exact number
  let promiseResult = sendTrxQuery(parentTrx.txHash, queue, metrics);

  // The API does not seem to have a way to choose the pages in the sub-transactions response.
  // Store only what is returned on the first page.
  // https://docs.binance.org/api-swagger/index.html#api-Tx-getTransaction
  const trxResult = await promiseResult;
  const correctedSubTrx = [];
  for(let subTrx of trxResult.subTxsDto.subTxDtoList) {
    correctedSubTrx.push(correctSubTrxFormat(subTrx, parentTrx));
  }

  subTrxMap[parentTrx.txHash] = correctedSubTrx;
}

class BNBTransactionsFetcher {
  constructor() {
    // The timestamp of the last block produced. Will be reduced with real value.
    this.lastBlockTimestamp = 0;
    // We start by fetching transactions for an hour. This will be dynamically reduced when the transactions number increase.
    this.msecInFetchRange = FETCH_INTERVAL_HISTORIC_MODE_MSEC;
  }
  async fetchTransactions(queue, timestampReached, metrics) {
    const intervalFetchStart = timestampReached + 1;
    let intervalFetchEnd = intervalFetchStart + this.msecInFetchRange;

    // When the exporter catches up with the Node, we need to limit the range of blocks we query
    if (intervalFetchEnd > this.lastBlockTimestamp - SAFETY_BLOCK_WAIT_MSEC) {
      this.lastBlockTimestamp = await utils.getLastBlockTimestamp(metrics);
      // Check again if the end interval is correct against the updated last block timestamp
      if (intervalFetchEnd > this.lastBlockTimestamp - SAFETY_BLOCK_WAIT_MSEC) {
        intervalFetchEnd = this.lastBlockTimestamp - SAFETY_BLOCK_WAIT_MSEC;
        this.msecInFetchRange = intervalFetchEnd - intervalFetchStart;
      }
    }

    const nodeResponsePromises = [];
    logger.info(`Fetching transactions for time interval: ${intervalFetchStart}-${intervalFetchEnd}`);
    const fetchScheduleSuccess = await fetchTimeInterval(queue, intervalFetchStart, intervalFetchEnd,
      nodeResponsePromises, metrics);

    if (!fetchScheduleSuccess) {
      logger.info(`Can not fetch time interval. Reducing interval size from ${this.msecInFetchRange} msec to \
${this.msecInFetchRange / 2} msec`);
      this.msecInFetchRange /= 2;
      // The data is compromised, nothing would be written on this iteration
      return { "success": false };
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

    return { "transactions": trxResults, "intervalFetchEnd": intervalFetchEnd,
      "lastFetchRangeMsec": this.msecInFetchRange, "lastBlockTimestamp": this.lastBlockTimestamp, "success": true
    };
  }
}

/**
 * Go over the transactions, and fetch sub transactions for those who have children.
 */
async function replaceParentTransactionsWithChildren(queue, baseTransactions, metrics) {
  const responsePromises = [];
  // A map storing parent trx id to an array of children transactions
  let subTrxMap = {}
  // Go over all base transactions and populate above map.
  for (const baseTrx of baseTransactions) {
    if (baseTrx.hasChildren > 0) {
      responsePromises.push( fetchTransactionWithChildren(queue, baseTrx, subTrxMap, metrics) );
    }
  }

  await Promise.all(responsePromises);
  const mergedTransactions = [];

  // Go over base transaction and replace parents with their children. Parent transactions does not seem to store useful information.
  for (const baseTrx of baseTransactions) {
    if (0 === baseTrx.hasChildren) {
      mergedTransactions.push(baseTrx);
    }
    else {
      mergedTransactions.push(...subTrxMap[baseTrx.txHash]);
    }
  }

  return mergedTransactions;
}

/**
 * Adjust the sub trx format from:
 *
 *  {
      "hash": "78763CF0B756E7DB3D1493E990C0273D970964682DA7D1C2EA5840DA90A60C2B",
      "height": 32903045,
      "type": "TRANSFER",
      "value": 100.00000000,
      "asset": "CAS-167",
      "fromAddr": "bnb1xkw2sagpx6t0cmwzapxpv94tupvqk7tpgy72ku",
      "toAddr": "bnb1xt3pqepfmvgw3lccf46rdny0amkwpyxrvz9tsr",
      "fee": null
    }

    to the format returned for common transactions:

    { "txHash":"3592D62EAC185C8CBFBD6D0FA9FA5C583B00016C3EBEEC65188123F7961AB0A7",
      "blockHeight":8372329,
      "txType":"TRANSFER",
      "timeStamp":1558788838694,
      "fromAddr":"bnb1nec75jrlhny7v04yjpuhzlgjvdsuehqs6perug",
      "toAddr":"bnb1avaal7rxhukq4gzplm6yavasquwjzmkt5z2mjw",
      "value":0.020465,
      "txAsset":"BNB",
      "txFee":0.000625,
      "hasChildren":0
    }
 */
function correctSubTrxFormat(childTrx, parentTrx) {
  const result = {
    txHash: childTrx.hash,
    blockHeight: childTrx.height,
    txType: childTrx.type,
    timeStamp: parentTrx.timeStamp,
    fromAddr: childTrx.fromAddr,
    toAddr: childTrx.toAddr,
    value: childTrx.value,
    txAsset: childTrx.asset,
    txFee: childTrx.fee,
    hasChildren: 0
  };

  return result;
}


/**
 * For what appears as a bug, the BNB API returns same results on different pages.
 * @param {*} listTrx An array of transactions to be filtered
 * @param {*} hashGetter A function which returns the hash for an element
 * @param {*} heightGetter A function which returns the block height for an element
 */
function filterRepeatedTransactions(listTrx) {
  const hashesCurrentBlock = new Set();
  let blockReached = 0;

  // Go backwards as the API has returned the transactions in reversed order.
  for (let index = listTrx.length - 1; index >= 0; --index) {
    const currentTrxHash = listTrx[index].txHash;
    const currentTrxHeight = listTrx[index].blockHeight;

    // Filter transaction if it appears out of order - it has a previous block number or
    // it has the current block number but its hash has been seen.
    if (currentTrxHeight < blockReached || hashesCurrentBlock.has(currentTrxHash)) {
      logger.info(`Repeated trx is filtered: ${currentTrxHash}`);
      listTrx.splice(index, 1);
    }
    else {
      // We are going to the next block number, clear the set of hashes.
      if (currentTrxHeight > blockReached) {
        blockReached = currentTrxHeight;
        hashesCurrentBlock.clear();
      }
      hashesCurrentBlock.add(currentTrxHash);
    }
  }
}


module.exports = {
  BNBTransactionsFetcher,
  replaceParentTransactionsWithChildren,
  filterRepeatedTransactions,
  SAFETY_BLOCK_WAIT_MSEC
}
