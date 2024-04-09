'use strict';
const { Web3 } = require('web3');
const helper = require('./lib/helper');
const { logger } = require('../../lib/logger');
const { constructRPCClient } = require('../../lib/http_client');
const { buildHttpOptions } = require('../../lib/build_http_options');
const BaseWorker = require('../../lib/worker_base');
const Web3Wrapper = require('../eth/lib/web3_wrapper');
const {
  nextIntervalCalculator,
  analyzeWorkerContext,
  setWorkerSleepTime,
  NO_WORK_SLEEP } = require('../eth/lib/next_interval_calculator');


class ReceiptsWorker extends BaseWorker {
  constructor(settings) {
    super(settings);

    logger.info(`Connecting to node ${settings.NODE_URL}`);
    const authCredentials = settings.RPC_USERNAME + ':' + settings.RPC_PASSWORD;
    const httpProviderOptions = buildHttpOptions(authCredentials);
    this.client = constructRPCClient(settings.NODE_URL, {
      method: 'POST',
      auth: authCredentials,
      timeout: this.DEFAULT_TIMEOUT,
      version: 2
    });
    this.web3Wrapper = new Web3Wrapper(new Web3(new Web3.providers.HttpProvider(settings.NODE_URL, httpProviderOptions)));
  }

  async init() {
    this.lastConfirmedBlock = await this.web3Wrapper.getBlockNumber() - this.settings.CONFIRMATIONS;
  }

  async fetchBlockTimestamps(fromBlock, toBlock) {
    const batch = [];
    for (let i = fromBlock; i < toBlock + 1; i++) {
      batch.push(
        this.client.request(
          this.settings.GET_BLOCK_ENDPOINT,
          [this.web3Wrapper.parseNumberToHex(i),
            true],
          undefined,
          false
        )
      );
    }

    return this.client.request(batch).then((responses) => helper.parseBlocks(responses));
  }

  async fetchReceiptsFromTransaction(blocks) {
    var batch = [];
    for (let block = 0; block < blocks.length; block++) {
      var transactions = blocks[block]['transactions'];
      if (transactions.length === 0) continue;
      for (let trx = 0; trx < transactions.length; trx++) {
        var transactionHash = transactions[trx]['hash'];
        batch.push(
          this.client.request(
            this.settings.GET_RECEIPTS_ENDPOINT,
            [transactionHash],
            undefined,
            false
          )
        );
      }
    }
    return (!batch.length) ? [] : this.client.request(batch).then((responses) => helper.parseTransactionReceipts(responses));
  }

  async getReceiptsForBlocks(fromBlock, toBlock) {
    logger.info(`Fetching blocks ${fromBlock}:${toBlock}`);
    const blocks = await this.fetchBlockTimestamps(fromBlock, toBlock);
    let receipts;

    if (!this.settings.TRANSACTION) {
      receipts = await this.fetchReceipts(fromBlock, toBlock);
    }
    else {
      receipts = await this.fetchReceiptsFromTransaction(blocks);
    }
    const decodedReceipts = receipts.map(receipt => helper.decodeReceipt(receipt, this.web3Wrapper));
    const decodedBlocks = blocks.map(block => helper.decodeBlock(block, this.web3Wrapper));
    const timestamps = helper.prepareBlockTimestampsObject(decodedBlocks);

    return helper.setReceiptsTimestamp(decodedReceipts, timestamps);
  }

  async fetchReceipts(fromBlock, toBlock) {
    const batch = [];
    for (let i = fromBlock; i <= toBlock; i++) {
      batch.push(
        this.client.request(
          this.settings.GET_RECEIPTS_ENDPOINT,
          [this.web3Wrapper.parseNumberToHex(i)],
          undefined,
          false
        )
      );
    }
    return this.client.request(batch).then((responses) => helper.parseReceipts(responses));
  }

  async work() {
    const workerContext = await analyzeWorkerContext(this);
    setWorkerSleepTime(this, workerContext);
    if (workerContext === NO_WORK_SLEEP) return [];

    const { fromBlock, toBlock } = nextIntervalCalculator(this);
    logger.info(`Fetching receipts for interval ${fromBlock}:${toBlock}`);
    const receipts = await this.getReceiptsForBlocks(fromBlock, toBlock);

    this.lastExportedBlock = toBlock;

    return receipts;
  }
}

module.exports = {
  worker: ReceiptsWorker
};
