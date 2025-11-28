'use strict';
import { Web3Static, safeCastToNumber } from '../../eth/lib/web3_wrapper';
import { HTTPClientInterface } from '../../../types'

export interface TimestampsCacheInterface {
  getBlockTimestamp(blockNumber: number): number;
  waitResponse(): Promise<boolean>;
  isResolved(): boolean;
}

export class TimestampsCache implements TimestampsCacheInterface {
  private timestampStore: { [key: number]: number };
  private rangeSize: number;
  private responsePromise: Promise<any>;
  private waitPromise?: Promise<void>;
  private resolved: boolean;

  constructor(ethClient: HTTPClientInterface, fromBlock: number, toBlock: number) {
    this.timestampStore = {};
    this.rangeSize = toBlock - fromBlock + 1;
    this.resolved = false;
    this.waitPromise = undefined;

    const blockRequests = Array.from(
      { length: toBlock - fromBlock + 1 },
      (_, index) => ethClient.generateRequest(
        'eth_getBlockByNumber',
        // Some Nodes would also accept decimal, but we convert to be on the safe side
        [Web3Static.parseNumberToHex(fromBlock + index), false]
      )
    );

    this.responsePromise = ethClient.requestBulk(blockRequests);
  }

  async waitResponse(): Promise<boolean> {
    if (this.resolved) {
      return false;
    }

    let isFirstAwaiter = false;

    if (!this.waitPromise) {
      isFirstAwaiter = true;
      this.waitPromise = (async () => {
        const resultsArray = await this.responsePromise;
        if (!Array.isArray(resultsArray)) {
          throw new Error('Blocks response is not an array');
        }
        if (resultsArray.length !== this.rangeSize) {
          throw new Error(`Expected ${this.rangeSize} but got ${resultsArray.length} blocks response`);
        }

        for (const result of resultsArray) {
          const blockNumber = safeCastToNumber(Web3Static.parseHexToNumber(result.result.number));
          const blockTimestamp = safeCastToNumber(Web3Static.parseHexToNumber(result.result.timestamp));
          this.timestampStore[blockNumber] = blockTimestamp;
        }
        this.resolved = true;
      })().catch(error => {
        // allow retries on subsequent waitResponse() calls
        this.waitPromise = undefined;
        throw error;
      });
    }

    await this.waitPromise;
    return isFirstAwaiter;
  }

  isResolved(): boolean {
    return this.resolved;
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
