'use strict';
import { Web3Interface, safeCastToNumber } from '../../eth/lib/web3_wrapper';
import { HTTPClientInterface } from '../../../types'

export interface TimestampsCacheInterface {
  getBlockTimestamp(blockNumber: number): number;
  waitResponse(): Promise<void>;
}

export class TimestampsCache implements TimestampsCacheInterface {
  private timestampStore: { [key: number]: number };
  private rangeSize: number;
  private web3Wrapper: Web3Interface;
  private responsePromise: Promise<any>;

  constructor(ethClient: HTTPClientInterface, web3Wrapper: Web3Interface, fromBlock: number, toBlock: number) {
    this.timestampStore = {};
    this.rangeSize = toBlock - fromBlock + 1;
    this.web3Wrapper = web3Wrapper;

    const blockRequests = Array.from(
      { length: toBlock - fromBlock + 1 },
      (_, index) => ethClient.generateRequest(
        'eth_getBlockByNumber',
        // Some Nodes would also accept decimal, but we convert to be on the safe side
        [web3Wrapper.parseNumberToHex(fromBlock + index), false]
      )
    );

    this.responsePromise = ethClient.requestBulk(blockRequests);
  }

  async waitResponse(): Promise<void> {
    const resultsArray = await this.responsePromise;
    if (!Array.isArray(resultsArray)) {
      throw new Error('Blocks response is not an array');
    }
    if (resultsArray.length !== this.rangeSize) {
      throw new Error(`Expected ${this.rangeSize} but got ${resultsArray.length} blocks response`);
    }

    for (const result of resultsArray) {
      const blockNumber = safeCastToNumber(this.web3Wrapper.parseHexToNumber(result.result.number));
      const blockTimestamp = safeCastToNumber(this.web3Wrapper.parseHexToNumber(result.result.timestamp));
      this.timestampStore[blockNumber] = blockTimestamp;
    }
  }

  getBlockTimestamp(blockNumber: number): number {
    if (Object.prototype.hasOwnProperty.call(this.timestampStore, blockNumber)) {
      return this.timestampStore[blockNumber];
    }
    else {
      throw new Error(`Missing timestamp for block number ${blockNumber}`);
    }
  }
}



