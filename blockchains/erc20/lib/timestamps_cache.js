'use strict';

class TimestampsCache {
  constructor(ethClient, web3Wrapper, fromBlock, toBlock) {
    this.timestampStore = {};
    this.rangeSize = toBlock - fromBlock + 1;
    this.web3Wrapper = web3Wrapper;

    const blockRequests = Array.from(
      { length: toBlock - fromBlock + 1 },
      (_, index) => ethClient.request(
        'eth_getBlockByNumber',
        // Some Nodes would also accept decimal, but we convert to be on the safe side
        [web3Wrapper.parseNumberToHex(fromBlock + index), false],
        undefined,
        false
      )
    );

    this.responsePromise = ethClient.request(blockRequests);
  }

  async waitResponse() {
    const resultsArray = await this.responsePromise;
    if (!Array.isArray(resultsArray)) {
      throw new Error('Blocks response is not an array');
    }
    if (resultsArray.length !== this.rangeSize) {
      throw new Error(`Expected ${this.rangeSize} but got ${resultsArray.length} blocks response`);
    }

    for (const result of resultsArray) {
      const blockNumber = this.web3Wrapper.parseHexToNumber(result.result.number);
      const blockTimestamp = this.web3Wrapper.parseHexToNumber(result.result.timestamp);
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
