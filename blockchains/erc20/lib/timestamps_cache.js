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

  async getTimestampFromNode(web3, blockNumber) {
    console.log('Getting timestamp for ', blockNumber);
    const block = await web3.eth.getBlock(blockNumber);
    return block['timestamp'];
  }


  async getBlockTimestamp(web3, blockNumber) {
    const timestampStore = this.getTimestampFromStore(blockNumber);
    if (timestampStore !== DATA_MISSING) {
      return timestampStore;
    }

    let timestamp = await this.getTimestampFromNode(web3, blockNumber);
    this.saveTimestampInStore(blockNumber, timestamp);

    return timestamp;
  }
}



module.exports = {
  TimestampsCache
};
