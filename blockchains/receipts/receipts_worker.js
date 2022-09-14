'use strict';
const Web3 = require('web3');
const array = require('lodash/array');
const jayson = require('jayson/promise');

const { logger } = require('../../lib/logger');
const constants = require('./lib/constants');
const BaseWorker = require('../../lib/worker_base');


class ReceiptsWorker extends BaseWorker {
  constructor() {
    super();
    logger.info(`Connecting to node ${constants.NODE_URL}`);
    this.client = jayson.client.http(constants.NODE_URL);
    this.web3 = new Web3(new Web3.providers.HttpProvider(constants.NODE_URL));
  }

  async init() {
    this.lastConfirmedBlock = await this.web3.eth.getBlockNumber() - constants.CONFIRMATIONS;
  }

  async parseReceipts(responses) {
    const receipts = responses.map((response) => response['result']);
    return array.compact(array.flatten(receipts));
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
    return this.client.request(batch).then((responses) => this.parseReceipts(responses));
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
    const receipts = await this.fetchReceipts(fromBlock, toBlock);

    this.lastExportTime = Date.now();
    this.lastExportedBlock = toBlock;

    return receipts;
  }
}

module.exports = {
  worker: ReceiptsWorker
};
