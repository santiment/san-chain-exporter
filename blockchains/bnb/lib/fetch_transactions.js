'use strict';
const { logger } = require('../../../lib/logger');
const utils = require('./utils');
const constants = require('./constants');


function sendTimeIntervalQuery(startTimeMsec, endTimeMsec, pageIndex, queue, metrics) {
  return queue.add(async () => {
    const queryString = {
      page: pageIndex,
      rows: constants.MAX_NUM_ROWS_TIME_INTERVAL,
      startTime: startTimeMsec,
      endTime: endTimeMsec
    };
    const serverUri = constants.SERVER_URL + 'txs';

    return await utils.sendRequest(queryString, serverUri, metrics);
  });
}

function sendBNBTradesTimeIntervalQuery(startTimeMsec, endTimeMsec, pageIndex, queue, metrics) {
  return queue.add(async () => {
    const queryString = {
      offset: pageIndex * constants.NUM_TRADE_ROWS_FETCH,
      limit: constants.NUM_TRADE_ROWS_FETCH,
      start: startTimeMsec,
      end: endTimeMsec,
      total: 1
    };

    return await utils.sendRequest(queryString, constants.SERVER_URL, metrics);
  });
}

function sendTrxQuery(trxId, queue, metrics) {
  return queue.add(async () => {
    const queryString = {
      txHash: trxId
    };
    const serverUri = constants.SERVER_URL + 'tx';

    return await utils.sendRequest(queryString, serverUri, metrics);
  });
}

function assertNumPagesCorrectness(firstPageResult, startTimeMsec, endTimeMsec, bnbTradesMode) {
  if (typeof firstPageResult === 'undefined' ||
    (bnbTradesMode && firstPageResult.trade === 'undefined') ||
    (!bnbTradesMode && firstPageResult.txArray === 'undefined')) {
    throw ('Error in fetch interval ', startTimeMsec, ' - ', endTimeMsec);
  }
}

function getNumPagesToIterate(firstPageResult, bnbTradesMode) {
  return bnbTradesMode ?
    Math.ceil(firstPageResult.total / constants.NUM_TRADE_ROWS_FETCH) :
    Math.ceil(firstPageResult.txNums / constants.MAX_NUM_ROWS_TIME_INTERVAL);

}

async function fetchTimeInterval(queue, startTimeMsec, endTimeMsec, nodeResponsePromises, metrics, bnbTradesMode) {
  // On the first iteration update with the exact number
  let pagesToIterate = constants.BNB_API_MAX_PAGE;
  const startPage = bnbTradesMode ? 0 : 1;
  for (let pageIndex = startPage; pageIndex <= pagesToIterate; ++pageIndex) {
    let promiseResult = bnbTradesMode ?
      sendBNBTradesTimeIntervalQuery(startTimeMsec, endTimeMsec, pageIndex, queue, metrics) :
      sendTimeIntervalQuery(startTimeMsec, endTimeMsec, pageIndex, queue, metrics);

    if (startPage === pageIndex) {
      // On the first request, check how many pages we would need to get
      const firstPageResult = await promiseResult;

      assertNumPagesCorrectness(firstPageResult, startTimeMsec, endTimeMsec, bnbTradesMode);
      pagesToIterate = getNumPagesToIterate(firstPageResult, bnbTradesMode);

      let intervalString = `${startTimeMsec}-${endTimeMsec}`;
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
  for (let subTrx of trxResult.subTxsDto.subTxDtoList) {
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
  let subTrxMap = {};
  // Go over all base transactions and populate above map.
  for (const baseTrx of baseTransactions) {
    if (baseTrx.hasChildren > 0) {
      responsePromises.push(fetchTransactionWithChildren(queue, baseTrx, subTrxMap, metrics));
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
 *
 * Example: The following query returns two repeating transactions:
 * curl 'https://explorer.bnbchain.org/api/v1/txs?startTime=1657028600029&endTime=1657028689649&page=6&rows=100'
 * and
 * curl 'https://explorer.bnbchain.org/api/v1/txs?startTime=1657028600029&endTime=1657028689649&page=7&rows=100'
 * would return the transactions:
 * "9415045541E182F508ED9D397F60621600DB594A43139FEE94BA99E20F11D832" and
 * "9373C96652A81CA777C4623D4C5205A070CFC89C7067DC8AB0B0C4F6BD098168" on both
 * page 6 and page 7.
 *
 * @param {*} listTrx An array of transactions to be filtered
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

/**
 * For reasons currently unknown the BNB API returns same results on different pages. Last result from page x may
 * appear as first result on page x + 1. That is the oldest result on page x may be the newest on page x + 1.
 * @param {*} listTrx An array of trades to be filtered

 */
function filterRepeatedTrade(listTrx) {
  let index = 1;

  while (index < listTrx.length) {
    if (listTrx[index].tradeId === listTrx[index - 1].tradeId) {
      listTrx.splice(index, 1);
    }
    else {
      ++index;
    }
  }
}


module.exports = {
  fetchTimeInterval,
  replaceParentTransactionsWithChildren,
  filterRepeatedTransactions,
  filterRepeatedTrade
};
