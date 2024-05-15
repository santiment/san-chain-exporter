import Web3Wrapper from './web3_wrapper';
import { Block, Transaction, Transfer } from '../eth_types';

export class FeesDecoder {
  private web3Wrapper: Web3Wrapper;

  constructor(web3Wrapper: Web3Wrapper) {
    this.web3Wrapper = web3Wrapper;
  }

  getPreLondonForkFees(transaction: any, block: Block, receipts: any) {
    const gasExpense = BigInt(this.web3Wrapper.parseHexToNumber(transaction.gasPrice)) * BigInt(this.web3Wrapper.parseHexToNumber(receipts[transaction.hash].gasUsed));
    return [{
      from: transaction.from,
      to: block.miner,
      value: Number(gasExpense),
      valueExactBase36: gasExpense.toString(36),
      blockNumber: this.web3Wrapper.parseHexToNumber(transaction.blockNumber),
      timestamp: this.web3Wrapper.parseHexToNumber(block.timestamp),
      transactionHash: transaction.hash,
      type: 'fee'
    }];
  }

  getBurntFee(transaction: any, block: Block, receipts: any,
    burnAddress: string): Transfer {
    const gasExpense = BigInt(this.web3Wrapper.parseHexToNumber(block.baseFeePerGas)) * BigInt(this.web3Wrapper.parseHexToNumber(receipts[transaction.hash].gasUsed));
    return {
      from: transaction.from,
      to: burnAddress,
      value: Number(gasExpense),
      valueExactBase36: gasExpense.toString(36),
      blockNumber: this.web3Wrapper.parseHexToNumber(transaction.blockNumber),
      timestamp: this.web3Wrapper.parseHexToNumber(block.timestamp),
      transactionHash: transaction.hash,
      type: 'fee_burnt'
    };
  }

  /**
   * We depend on:
   * "Block validity is defined in the reference implementation below. The GASPRICE (0x3a) opcode MUST return the
   * effective_gas_price as defined in the reference implementation below."
   *
   * 'gasPrice' would be set to gas price paid by the signer of the transaction no matter if the transaction is
   * 'type 0, 1 or 2.
   *
   * https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1559.md
   **/
  getMinerFee(transaction: Transaction, block: Block, receipts: any): Transfer | undefined {
    const tipMinerPerGas = BigInt(this.web3Wrapper.parseHexToNumber(transaction.gasPrice)) - BigInt(this.web3Wrapper.parseHexToNumber(block.baseFeePerGas));
    const gasExpense = tipMinerPerGas * BigInt(this.web3Wrapper.parseHexToNumber(receipts[transaction.hash].gasUsed));
    if (tipMinerPerGas > 0) {
      return {
        from: transaction.from,
        to: block.miner,
        value: Number(gasExpense),
        valueExactBase36: gasExpense.toString(36),
        blockNumber: this.web3Wrapper.parseHexToNumber(transaction.blockNumber),
        timestamp: this.web3Wrapper.parseHexToNumber(block.timestamp),
        transactionHash: transaction.hash,
        type: 'fee'
      };
    }
    else {
      return undefined
    }
  }

  getPostLondonForkFees(transaction: Transaction, block: Block, receipts: any, burnAddress: string): Transfer[] {
    const result: Transfer[] = [];
    result.push(this.getBurntFee(transaction, block, receipts, burnAddress));
    const minerFee = this.getMinerFee(transaction, block, receipts);
    if (minerFee !== undefined) {
      result.push(minerFee)
    }

    return result;
  }

  getFeesFromTransactionsInBlock(block: Block, blockNumber: number, receipts: any, isETH: boolean,
    burnAddress: string, londonForkBlock: number): Transfer[] {
    const result: Transfer[] = [];
    block.transactions.forEach((transaction: Transaction) => {
      const feeTransfers =
        isETH && blockNumber >= londonForkBlock ?
          this.getPostLondonForkFees(transaction, block, receipts, burnAddress) :
          this.getPreLondonForkFees(transaction, block, receipts);

      result.push(...feeTransfers);
    });
    return result;
  }
}

module.exports = {
  FeesDecoder
};