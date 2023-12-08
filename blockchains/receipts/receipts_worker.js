'use strict';
const { Web3 } = require('web3');
const jayson = require('jayson/promise');

const helper = require('./lib/helper');
const { logger } = require('../../lib/logger');
const BaseWorker = require('../../lib/worker_base');
const Web3Wrapper = require('../eth/lib/web3_wrapper');


class ReceiptsWorker extends BaseWorker {
  constructor(settings) {
    super(settings);

    logger.info(`Connecting to node ${settings.NODE_URL}`);
    this.client = jayson.client.https(settings.NODE_URL);
    this.web3Wrapper = new Web3Wrapper(new Web3(new Web3.providers.HttpProvider(settings.NODE_URL)));
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
    if (this.lastConfirmedBlock === this.lastExportedBlock) {
      this.sleepTimeMsec = this.settings.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;

      const newConfirmedBlock = await this.web3Wrapper.getBlockNumber() - this.settings.CONFIRMATIONS;
      if (newConfirmedBlock === this.lastConfirmedBlock) {
        return [];
      }
      this.lastConfirmedBlock = newConfirmedBlock;
    } else {
      this.sleepTimeMsec = 0;
    }

    const toBlock = Math.min(this.lastExportedBlock + this.settings.BLOCK_INTERVAL, this.lastConfirmedBlock);
    const fromBlock = this.lastExportedBlock + 1;

    logger.info(`Fetching receipts for interval ${fromBlock}:${toBlock}`);
    const receipts = await this.getReceiptsForBlocks(fromBlock, toBlock);

    this.lastExportedBlock = toBlock;

    return receipts;
  }
}

module.exports = {
  worker: ReceiptsWorker
};
