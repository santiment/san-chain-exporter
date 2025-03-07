import { Web3Interface } from '../../blockchains/eth/lib/web3_wrapper';

export class MockWeb3Wrapper implements Web3Interface {
  private blockNumber: number;

  constructor(blockNumber: number) {
    this.blockNumber = blockNumber;
  }

  getBlockNumber(): Promise<number> {
    return Promise.resolve(this.blockNumber)
  }

  getPastLogs(queryObject: any): Promise<any> {
    throw Error("Should not be called")
  }

}

export class MockEthClient {
  private result: any;

  constructor(result?: any) {
    this.result = result;
  }

  request(): Promise<any> {
    return Promise.resolve(this.result)
  }

  requestBulk(): Promise<any> {
    return Promise.resolve(this.result)
  }

  generateRequest(): any {
    return null;
  }
}
