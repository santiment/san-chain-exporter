'use strict';
const { logger } = require('../../../lib/logger');
const DATA_MISSING = -1;

class TimestampsManager {
  constructor() {
  }

  async init(exporter) {
    this.exporter = exporter;
    this.timestampStore = {};
    this.lastTimestampUsed = {
      blockNumber: parseInt(process.env.START_BLOCK || '-1'),
      timestamp: parseInt(process.env.START_TIMESTAMP || '-1')
    };
    await this.loadLastTimestampFromZK();
  }

  async loadLastTimestampFromZK() {
    const lastPosition = await this.exporter.getLastBlockTimestamp();

    if (lastPosition) {
      this.lastTimestampUsed = lastPosition;
      logger.info(`Resuming export from timestamp ${JSON.stringify(lastPosition)}`);

      this.saveTimestampInStore(lastPosition.blockNumber, lastPosition.timestamp);
    }
  }

  saveTimestampInStore(blockNumber, timestamp) {
    this.timestampStore[blockNumber] = timestamp;
  }

  saveTimestampInZK(blockNumber, timestamp) {
    this.lastTimestampUsed.blockNumber = blockNumber;
    this.lastTimestampUsed.timestamp = timestamp;

    this.exporter.saveLastBlockTimestamp(this.lastTimestampUsed);
  }

  getTimestampFromStore(blockNumber) {
    if (Object.prototype.hasOwnProperty.call(this.timestampStore, blockNumber)) {
      return this.timestampStore[blockNumber];
    }

    return DATA_MISSING;
  }

  async getTimestampFromNode(web3, blockNumber) {
    const block = await web3.eth.getBlock(blockNumber);
    return block['timestamp'];
  }

  increaseTimestampIfNeed(blockNumber, timestamp) {
    if (this.lastTimestampUsed.timestamp > timestamp) {
      logger.info(`Correcting timestamp for block  ${blockNumber} from ${timestamp}
        to ${this.lastTimestampUsed.timestamp + 1}`);
      return this.lastTimestampUsed.timestamp + 1;
    }

    return timestamp;
  }

  async getBlockTimestamp(web3, blockNumber) {
    const timestampStore = this.getTimestampFromStore(blockNumber);
    if (timestampStore != DATA_MISSING) {
      return timestampStore;
    }

    let timestamp = await this.getTimestampFromNode(web3, blockNumber);
    timestamp = this.increaseTimestampIfNeed(blockNumber, timestamp);

    this.saveTimestampInStore(blockNumber, timestamp);
    this.saveTimestampInZK(blockNumber, timestamp);
    this.lastTimestampUsed.timestamp = timestamp;

    return timestamp;
  }
}



module.exports = {
  TimestampsManager
};
