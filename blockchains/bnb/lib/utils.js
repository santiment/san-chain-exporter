"use strict";

const { logger } = require('../../../lib/logger')
const got = require('got');


// Hint for ESlint
/* global SERVER_URL */

/**
 * Not setting 'blockHeight' will return the block
 */
async function readLastBlock(metrics) {

  const queryString = {
    page: 1,
    rows: 1
  };

  const serverUri = SERVER_URL + "txs";
  return sendRequest(queryString, serverUri, metrics);
}

async function sendRequest(queryString, serverUri, metrics) {
  metrics.requestsCounter.inc();

  return await got.get(serverUri, queryString)
}

/**
 * Get the timestamp of the last block produced by the Node.
 */
async function getLastBlockTimestamp(metrics) {
  const lastBlock = await readLastBlock(metrics);
  const currentBlockNumber = lastBlock.txArray[0].blockHeight;

  const lastNodeTimestamp = lastBlock.txArray[0].timeStamp;
  logger.info(`Node synced up until block: ${currentBlockNumber}, timestamp: ${lastNodeTimestamp}`);
  return lastNodeTimestamp
}


module.exports = {
  getLastBlockTimestamp,
  sendRequest
}
