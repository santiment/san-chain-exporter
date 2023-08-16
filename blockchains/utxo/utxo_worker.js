'use strict';
const jayson = require('jayson/promise');
const { parseURL } = require('whatwg-url');
const { logger } = require('../../lib/logger');
const BaseWorker = require('../../lib/worker_base');
const {
  DOGE,
  NODE_URL,
  MAX_RETRIES,
  RPC_PASSWORD,
  RPC_USERNAME,
  CONFIRMATIONS,
  DEFAULT_TIMEOUT,
  MAX_CONCURRENT_REQUESTS,
  LOOP_INTERVAL_CURRENT_MODE_SEC
} = require('./lib/constants');

const URL = parseURL(NODE_URL);

class UtxoWorker extends BaseWorker {
  constructor() {
    super();

    logger.info(`Connecting to the node ${NODE_URL}`);
    this.client = jayson.Client.https({
      host: URL.host,
      port: URL.port,
      method: 'POST',
      auth: RPC_USERNAME + ':' + RPC_PASSWORD,
      timeout: DEFAULT_TIMEOUT,
      version: 1
    });
  }

  async init() {
    const blockchainInfo = await this.sendRequestWithRetry('getblockchaininfo', []);
    this.lastConfirmedBlock = blockchainInfo.blocks - CONFIRMATIONS;
  }

  async sendRequest(method, params) {
    return this.client.request(method, params).then(({ result, error }) => {
      if (error) {
        return Promise.reject(error);
      }

      return result;
    });
  }

  async sendRequestWithRetry(method, params) {
    let retries = 0;
    let retryIntervalMs = 0;
    while (retries < MAX_RETRIES) {
      try {
        const response = await this.sendRequest(method, params).catch(err => Promise.reject(err));
        if (response.error || response.result === null) {
          retries++;
          retryIntervalMs += (2000 * retries);
          logger.error(`sendRequest with ${method} failed. Reason: ${response.error}. Retrying for ${retries} time`);
          await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
          continue;
        }
        return response;
      } catch(err) {
        retries++;
        retryIntervalMs += (2000 * retries);
        logger.error(
          `Try block in sendRequest for ${method} failed. Reason: ${err.toString()}. Waiting ${retryIntervalMs} and retrying for ${retries} time`
          );
        await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
      }
    }
    return Promise.reject(`sendRequest for ${method} failed after ${MAX_RETRIES} retries`);
  }

  async decodeTransaction(transaction_bytecode) {
    return await this.sendRequestWithRetry('decoderawtransaction', [transaction_bytecode]);
  }

  async getTransactionData(transaction_hashes) {
    const decodedTransactions = [];
    for (const transaction_hash of transaction_hashes) {
      const transactionBytecode = await this.sendRequestWithRetry('getrawtransaction', [transaction_hash]);
      const decodedTransaction = await this.decodeTransaction(transactionBytecode);
      decodedTransactions.push(decodedTransaction);
    }

    return decodedTransactions;
  }

  async fetchBlock(block_index) {
    let blockHash = await this.sendRequestWithRetry('getblockhash', [block_index]);
    if (DOGE) {
      let blockData = await this.sendRequestWithRetry('getblock', [blockHash, true]);
      let transactionData = await this.getTransactionData(blockData.tx);
      blockData['tx'] = transactionData;

      return blockData;
    }
    return await this.sendRequestWithRetry('getblock', [blockHash, 2]);
  }

  async work() {
    if (this.lastConfirmedBlock === this.lastExportedBlock) {
      this.sleepTimeMsec = LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;

      const blockchainInfo = await this.sendRequestWithRetry('getblockchaininfo', []);
      const newConfirmedBlock = blockchainInfo.blocks - CONFIRMATIONS;
      if (newConfirmedBlock === this.lastConfirmedBlock) {
        return [];
      }
      this.lastConfirmedBlock = newConfirmedBlock;
    }
    else {
      this.sleepTimeMsec = 0;
    }

    const numConcurrentRequests = Math.min(MAX_CONCURRENT_REQUESTS, this.lastConfirmedBlock - this.lastExportedBlock);
    const requests = Array.from({ length: numConcurrentRequests }, (_, i) => this.fetchBlock(this.lastExportedBlock + 1 + i));
    const blocks = await Promise.all(requests);
    this.lastExportedBlock += blocks.length;
    return blocks;
  }
}

module.exports = {
  worker: UtxoWorker
};
