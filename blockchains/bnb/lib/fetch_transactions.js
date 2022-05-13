"use strict";
const { logger } = require('../../../lib/logger')
const utils = require('./utils')
const constants = require("./constants")


function sendTimeIntervalQuery(startTimeMsec, endTimeMsec, pageIndex, queue, metrics) {
  return queue.add(async () => {
    const queryString = {
      page: pageIndex,
      rows: constants.MAX_NUM_ROWS_TIME_INTERVAL,
      startTime: startTimeMsec,
      endTime: endTimeMsec
    };
    const serverUri = constants.SERVER_URL + "txs"

    return await utils.sendRequest(queryString, serverUri, metrics)
  })
}

function sendTrxQuery(trxId, queue, metrics) {
  return queue.add(async () => {
    const queryString = {
       txHash: trxId
    };
    const serverUri = constants.SERVER_URL + "tx"

    return await utils.sendRequest(queryString, serverUri, metrics)
  })
}

async function fetchTimeInterval(queue, startTimeMsec, endTimeMsec, nodeResponsePromises, metrics) {
  // On the first iteration update with the exact number
  let pagesToIterate = constants.BNB_API_MAX_PAGE;
  for (let pageIndex = 1; pageIndex <= pagesToIterate; ++pageIndex) {
    let promiseResult = sendTimeIntervalQuery(startTimeMsec, endTimeMsec, pageIndex, queue, metrics);

    if (1 === pageIndex) {
      // On the first request, check how many pages we would need to get
      const firstPageResult = await promiseResult;

      if (typeof firstPageResult === 'undefined' || firstPageResult.txArray === 'undefined') {
        throw ("Error in fetch interval ", startTimeMsec, " - ", endTimeMsec);
      }

      pagesToIterate = Math.ceil(firstPageResult.txNums / constants.MAX_NUM_ROWS_TIME_INTERVAL);

      let intervalString = `${startTimeMsec}-${endTimeMsec}`
      logger.info(`Interval ${intervalString} has ${pagesToIterate} pages`);

      if (pagesToIterate > constants.BNB_API_MAX_PAGE) {
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
  fetchTimeInterval,
  replaceParentTransactionsWithChildren,
  filterRepeatedTransactions
}
