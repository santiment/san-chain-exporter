'use strict';
const DATA_MISSING = -1;

class TimestampsCache {
  constructor() {
    this.timestampStore = {};
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
    // Cast the timestamp to Number as that is how we expect it for historic reasons
    return Number(block['timestamp']);
  }


  async getBlockTimestamp(web3Wrapper, blockNumber) {
    const timestampStore = this.getTimestampFromStore(blockNumber);
    if (timestampStore !== DATA_MISSING) {
      return timestampStore;
    }

    const timestamp = await this.getTimestampFromNode(web3Wrapper, blockNumber);
    this.saveTimestampInStore(blockNumber, timestamp);

    return timestamp;
  }
}



module.exports = {
  TimestampsCache
};
