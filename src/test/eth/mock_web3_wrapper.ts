import { Web3Interface, constructWeb3WrapperNoCredentials } from '../../blockchains/eth/lib/web3_wrapper';
import { NODE_URL } from '../../blockchains/erc20/lib/constants';

export class MockWeb3Wrapper implements Web3Interface {
  private blockNumber: number;

  constructor(blockNumber: number) {
    this.blockNumber = blockNumber;
  }

  private web3Wrapper = constructWeb3WrapperNoCredentials(NODE_URL)

  parseHexToNumberString(field: string): string {
    return this.web3Wrapper.parseHexToNumberString(field)
  }

  parseHexToNumber(field: string): number | bigint {
    return this.web3Wrapper.parseHexToNumber(field)
  }

  parseNumberToHex(field: number): string {
    return this.web3Wrapper.parseNumberToHex(field)
  }

  parseHexToBase36String(field: string): string {
    return this.web3Wrapper.parseHexToBase36String(field)
  }

  getBlockNumber(): Promise<number> {
    return Promise.resolve(this.blockNumber)
  }

  getPastLogs(queryObject: any): Promise<any> {
    throw Error("Should not be called")
  }

  etherToWei(amount: string): number {
    return this.web3Wrapper.etherToWei(amount)
  }

  gweiToWei(amount: string): number {
    return this.web3Wrapper.gweiToWei(amount)
  }
}