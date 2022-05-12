"use strict";

const { logger } = require('../../../lib/logger')
const got = require('got')
const uuidv1 = require('uuid/v1')
const DEFAULT_TIMEOUT_MSEC = parseInt(process.env.DEFAULT_TIMEOUT || "30000")

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
