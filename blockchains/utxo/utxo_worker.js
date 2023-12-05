'use strict';
const jayson = require('jayson/promise');
const { parseURL } = require('whatwg-url');
const { logger } = require('../../lib/logger');
const BaseWorker = require('../../lib/worker_base');


class UtxoWorker extends BaseWorker {
  constructor(constants) {
    super();

    this.NODE_URL = constants.NODE_URL;
    this.URL = parseURL(this.NODE_URL);
    this.MAX_RETRIES = constants.MAX_RETRIES,
      this.RPC_PASSWORD = constants.RPC_PASSWORD;
    this.RPC_USERNAME = constants.RPC_USERNAME;
    this.CONFIRMATIONS = constants.CONFIRMATIONS;
    this.DEFAULT_TIMEOUT = constants.DEFAULT_TIMEOUT;
    this.MAX_CONCURRENT_REQUESTS = constants.MAX_CONCURRENT_REQUESTS;
    this.LOOP_INTERVAL_CURRENT_MODE_SEC = constants.LOOP_INTERVAL_CURRENT_MODE_SEC;

    logger.info(`Connecting to the node ${this.NODE_URL}`);
    this.client = jayson.Client.https({
      host: URL.host,
      port: URL.port,
      method: 'POST',
      auth: this.RPC_USERNAME + ':' + this.RPC_PASSWORD,
      timeout: this.DEFAULT_TIMEOUT,
      version: 1
    });
  }

  async init() {
    const blockchainInfo = await this.sendRequestWithRetry('getblockchaininfo', []);
    this.lastConfirmedBlock = blockchainInfo.blocks - this.CONFIRMATIONS;
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
    while (retries < this.MAX_RETRIES) {
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
      } catch (err) {
        retries++;
        retryIntervalMs += (2000 * retries);
        logger.error(
          `Try block in sendRequest for ${method} failed. Reason: ${err.toString()}. Waiting ${retryIntervalMs} and retrying for ${retries} time`
        );
        await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
      }
    }
    return Promise.reject(`sendRequest for ${method} failed after ${this.MAX_RETRIES} retries`);
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
    return await this.sendRequestWithRetry('getblock', [blockHash, 2]);
  }

  async work() {
    if (this.lastConfirmedBlock === this.lastExportedBlock) {
      this.sleepTimeMsec = this.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;

      const blockchainInfo = await this.sendRequestWithRetry('getblockchaininfo', []);
      const newConfirmedBlock = blockchainInfo.blocks - this.CONFIRMATIONS;
      if (newConfirmedBlock === this.lastConfirmedBlock) {
        return [];
      }
      this.lastConfirmedBlock = newConfirmedBlock;
    }
    else {
      this.sleepTimeMsec = 0;
    }

    const numConcurrentRequests = Math.min(this.MAX_CONCURRENT_REQUESTS, this.lastConfirmedBlock - this.lastExportedBlock);
    const requests = Array.from({ length: numConcurrentRequests }, (_, i) => this.fetchBlock(this.lastExportedBlock + 1 + i));
    const blocks = await Promise.all(requests);
    this.lastExportedBlock += blocks.length;
    return blocks;
  }
}

module.exports = {
  worker: UtxoWorker
};
