'use strict';
const { logger } = require('../../../lib/logger');

const DATA_MISSING = -1;

class TimestampsCache {
  constructor() {
    this.timestampStore = {};
    this.highestNodeFetchedBlock = 0;
  }

  saveTimestampInStore(blockNumber, timestamp) {
    this.timestampStore[blockNumber] = timestamp;
  }

  getTimestampFromStore(blockNumber) {
    if (Object.prototype.hasOwnProperty.call(this.timestampStore, blockNumber)) {
      return this.timestampStore[blockNumber];
    }

    return DATA_MISSING;
  }

  async getTimestampFromNode(web3Wrapper, blockNumber) {
    const block = await web3Wrapper.getBlock(blockNumber);
    const timestamp = Number(block['timestamp']);
    this.saveTimestampInStore(blockNumber, timestamp);
    if (this.highestNodeFetchedBlock < blockNumber) {
      this.highestNodeFetchedBlock = blockNumber;
    }
    return timestamp;
  }


  async getBlockTimestamp(web3Wrapper, blockNumber) {
    const timestampStore = this.getTimestampFromStore(blockNumber);
    if (timestampStore !== DATA_MISSING) {
      return timestampStore;
    }

    const timestamp = await this.getTimestampFromNode(web3Wrapper, blockNumber);


    return timestamp;
  }
}


class WarmupTimestampsCache extends TimestampsCache {
  constructor(cacheForwardWarmup, cacheBackwardSize) {
    super();
    this.highestUserRequestedBlock = 0;
    this.cacheForwardWarmup = cacheForwardWarmup;
    this.cacheBackwardSize = cacheBackwardSize;
    this.cacheWarmupInProgress = false;
  }

  async getBlockTimestamp(web3Wrapper, blockNumber) {
    const blockNumberCast = Number(blockNumber);
    if (blockNumberCast > this.highestUserRequestedBlock) {
      this.highestUserRequestedBlock = blockNumberCast;

      if (!this.cacheWarmupInProgress) {
        // Do not await on the cache warm up. This should happen in the background.
        this.tryWarmCache(web3Wrapper);
      }

      this.tryCleanCache();
    }

    const result = await super.getBlockTimestamp(web3Wrapper, blockNumberCast);
    return result;
  }

  async tryWarmCache(web3Wrapper) {
    this.cacheWarmupInProgress = true;
    while (this.highestUserRequestedBlock + this.cacheForwardWarmup > this.highestNodeFetchedBlock &&
      this.highestNodeFetchedBlock < web3Wrapper.lastBlockNumber) {
      //logger.info(`Warming cache for block: ${this.highestNodeFetchedBlock + 1}`)
      await this.getTimestampFromNode(web3Wrapper, this.highestNodeFetchedBlock + 1);
    }
    this.cacheWarmupInProgress = false;
  }

  tryCleanCache() {
    logger.info(`Cache size is ${Object.keys(this.timestampStore).length}`);
    Object.keys(this.timestampStore).forEach((key) => {
      if (Number(key) < this.highestUserRequestedBlock - this.cacheBackwardSize) {
        //console.log(`Deleting key ${key}`);
        delete this.timestampStore[key];
      }
    });
  }
}


module.exports = {
  TimestampsCache,
  WarmupTimestampsCache
};
