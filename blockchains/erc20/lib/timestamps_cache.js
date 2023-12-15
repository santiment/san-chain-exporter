'use strict';

class TimestampsCache {
  constructor(ethClient, fromBlock, toBlock) {
    this.timestampStore = {};
    this.rangeSize = toBlock - fromBlock + 1;

    const blockRequests = [];
    for (let i = fromBlock; i <= toBlock; i++) {
      blockRequests.push(
        ethClient.request(
          'eth_getBlockByNumber',
          [i, false],
          undefined,
          false
        )
      );
    }

    this.responsePromise = ethClient.request(blockRequests);
  }

  async waitResponse(web3Wrapper) {
    const resultsArray = await this.responsePromise;
    if (!Array.isArray(resultsArray)) {
      throw new Error('Blocks response is not an array');
    }
    if (resultsArray.length !== this.rangeSize) {
      throw new Error(`Expected ${this.rangeSize} but got ${resultsArray.length} blocks response`);
    }

    for (const result of resultsArray) {
      const blockNumber = web3Wrapper.parseHexToNumber(result.result.number);
      const blockTimestamp = web3Wrapper.parseHexToNumber(result.result.timestamp);
      this.timestampStore[blockNumber] = blockTimestamp;
    }


  }

  getBlockTimestamp(blockNumber) {
    if (Object.prototype.hasOwnProperty.call(this.timestampStore, blockNumber)) {
      return this.timestampStore[blockNumber];
    }
    else {
      throw new Error(`Missing timestamp for block number ${blockNumber}`);
    }
  }
}


module.exports = {
  TimestampsCache
};
