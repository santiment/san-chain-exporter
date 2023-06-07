'use strict';
const Web3 = require('web3');
const jayson = require('jayson/promise');

const helper = require('./lib/helper');
const constants = require('./lib/constants');
const { logger } = require('../../lib/logger');
const BaseWorker = require('../../lib/worker_base');


class ReceiptsWorker extends BaseWorker {
  constructor() {
    super();
    logger.info(`Connecting to node ${constants.NODE_URL}`);
    this.client = jayson.client.https(constants.NODE_URL);
    this.web3 = new Web3(new Web3.providers.HttpProvider(constants.NODE_URL));
  }

  async init() {
    this.lastConfirmedBlock = await this.web3.eth.getBlockNumber() - constants.CONFIRMATIONS;
  }

  async fetchBlockTimestamps(fromBlock, toBlock) {
    const batch = [];
    for (let i = fromBlock; i < toBlock + 1; i++) {
      batch.push(
        this.client.request(
          constants.GET_BLOCK_ENDPOINT,
          [this.web3.utils.numberToHex(i),
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
            constants.GET_RECEIPTS_ENDPOINT,
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

    if(!constants.TRANSACTION) {
      receipts = await this.fetchReceipts(fromBlock, toBlock);
    }
    else {
      receipts = await this.fetchReceiptsFromTransaction(blocks);
    }
    const decodedReceipts = receipts.map(helper.decodeReceipt);
    const decodedBlocks = blocks.map(helper.decodeBlock);
    const timestamps = helper.prepareBlockTimestampsObject(decodedBlocks);

    return helper.setReceiptsTimestamp(decodedReceipts, timestamps);
  }

  async fetchReceipts(fromBlock, toBlock) {
    const batch = [];
    for (let i = fromBlock; i <= toBlock; i++) {
      batch.push(
        this.client.request(
          constants.GET_RECEIPTS_ENDPOINT,
          [this.web3.utils.numberToHex(i)],
          undefined,
          false
        )
      );
    }
    return this.client.request(batch).then((responses) => helper.parseReceipts(responses));
  }

  async work() {
    if (this.lastConfirmedBlock === this.lastExportedBlock) {
      this.sleepTimeMsec = constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;

      const newConfirmedBlock = await this.web3.eth.getBlockNumber() - constants.CONFIRMATIONS;
      if (newConfirmedBlock === this.lastConfirmedBlock) {
        return [];
      }
      this.lastConfirmedBlock = newConfirmedBlock;
    } else {
      this.sleepTimeMsec = 0;
    }

    const toBlock = Math.min(this.lastExportedBlock + constants.BLOCK_INTERVAL, this.lastConfirmedBlock);
    const fromBlock = this.lastExportedBlock + 1;

    logger.info(`Fetching receipts for interval ${fromBlock}:${toBlock}`);
    const receipts = await this.getReceiptsForBlocks(fromBlock, toBlock);

    this.lastExportTime = Date.now();
    this.lastExportedBlock = toBlock;

    return receipts;
  }
}

module.exports = {
  worker: ReceiptsWorker
};
