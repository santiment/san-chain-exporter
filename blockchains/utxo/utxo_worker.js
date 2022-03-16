'use strict';
const uuidv1 = require('uuid/v1');
const { logger } = require('../../lib/logger');
const rp = require('request-promise-native');
const BaseWorker = require('../../lib/worker_base');
const {
  NODE_URL,
  RPC_PASSWORD,
  RPC_USERNAME,
  DEFAULT_TIMEOUT,
  DOGE,
  CONFIRMATIONS,
  LOOP_INTERVAL_CURRENT_MODE_SEC
} = require('./lib/constants');


class UtxoWorker extends BaseWorker {
  constructor() {
    super();

    logger.info(`Connecting to the node ${NODE_URL}`);
    this.request = rp.defaults({
      method: 'POST',
      uri: NODE_URL,
      auth: {
        user: RPC_USERNAME,
        pass: RPC_PASSWORD
      },
      timeout: DEFAULT_TIMEOUT,
      time: true,
      gzip: true,
      json: true
    });
  }

  async init() {
    const blockchainInfo = await this.sendRequest('getblockchaininfo', []);
    this.lastConfirmedBlock = blockchainInfo.blocks - CONFIRMATIONS;
  }

  async sendRequest(method, params) {
    return this.request({
      body: {
        jsonrpc: '1.0',
        id: uuidv1(),
        method: method,
        params: params
      }
    }).then(({ result, error }) => {
      if (error) {
        return Promise.reject(error);
      }
  
      return result;
    });
  }

  async decodeTransaction(transaction_bytecode) {
    return await this.sendRequest('decoderawtransaction', [transaction_bytecode]);
  }

  async getTransactionData(transaction_hashes) {
    const decodedTransactions = [];
    for (const transaction_hash of transaction_hashes) {
      const transactionBytecode = await this.sendRequest('getrawtransaction', [transaction_hash]);
      const decodedTransaction = await this.decodeTransaction(transactionBytecode);
      decodedTransactions.push(decodedTransaction);
    }

    return decodedTransactions;
  }

  async fetchBlock(block_index) {
    let blockHash = await this.sendRequest('getblockhash', [block_index]);
    if (DOGE) {
      let blockData = await this.sendRequest('getblock', [blockHash, true]);
      let transactionData = await this.getTransactionData(blockData.tx);
      blockData['tx'] = transactionData;

      return blockData;
    }
    return await this.sendRequest('getblock', [blockHash, 2]);
  }

  async work() {
    if (this.lastConfirmedBlock === this.lastExportedBlock) {
      this.sleepTimeMsec = LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;

      const blockchainInfo = await this.sendRequest('getblockchaininfo', []);
      const newConfirmedBlock = blockchainInfo.blocks - CONFIRMATIONS;
      if (newConfirmedBlock === this.lastConfirmedBlock) {
        return [];
      }
      this.lastConfirmedBlock = newConfirmedBlock;
    }
    else {
      this.sleepTimeMsec = 0;
    }

    const requests = [];

    while (this.lastExportedBlock + requests.length <= this.lastConfirmedBlock) {
      const blockToDownload = this.lastExportedBlock + requests.length;

      requests.push(this.fetchBlock(blockToDownload));

      if (blockToDownload >= this.lastConfirmedBlock || requests.length > 50) {
        const blocks = await Promise.all(requests);
        this.lastExportedBlock = blockToDownload;
        logger.info(`Flushing blocks ${blocks[0].height}:${blocks[blocks.length - 1].height}`);
        return blocks;
      }
    }
  }
}

module.exports = {
  worker: UtxoWorker
};
