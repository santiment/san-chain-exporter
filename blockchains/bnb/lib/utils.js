"use strict";

const { logger } = require('../../../lib/logger')
const constants = require("./constants")
const got = require('got')


/**
 * Not setting 'blockHeight' will return the last block
 */
async function readLastBlock(metrics) {

  const queryString = {
    page: 1,
    rows: 1
  };

  const serverUri = constants.SERVER_URL + "txs";
  return sendRequest(queryString, serverUri, metrics);
}

async function sendRequest(query, serverUri, metrics) {
  metrics.increment();

  const result = await got.get(serverUri, {
    searchParams: query,
    resolveBodyOnly: true
  })

  return JSON.parse(result)
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
