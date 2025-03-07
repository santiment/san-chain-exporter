import assert from 'assert'
import { Web3Static, safeCastToNumber } from './web3_wrapper';
import { ETHBlock, ETHTransaction, ETHTransfer, ETHReceiptsMap } from '../eth_types';
import { BURN_ADDRESS, LONDON_FORK_BLOCK } from './constants';


function isETHTransaction(transaction: ETHTransaction | string): transaction is ETHTransaction {
  return typeof transaction === 'object' && 'hash' in transaction && 'from' in transaction;
}

export class FeesDecoder {
  getPreLondonForkFees(transaction: ETHTransaction, block: ETHBlock, receipts: any): ETHTransfer[] {
    const gasExpense = BigInt(Web3Static.parseHexToNumber(transaction.gasPrice)) *
      BigInt(Web3Static.parseHexToNumber(receipts[transaction.hash].gasUsed));
    return [{
      from: transaction.from,
      to: block.miner,
      value: Number(gasExpense),
      valueExactBase36: gasExpense.toString(36),
      blockNumber: safeCastToNumber(Web3Static.parseHexToNumber(transaction.blockNumber)),
      timestamp: safeCastToNumber(Web3Static.parseHexToNumber(block.timestamp)),
      transactionHash: transaction.hash,
      transactionPosition: safeCastToNumber(Web3Static.parseHexToNumber(transaction.transactionIndex)),
      internalTxPosition: 0,
      type: 'fee'
    }];
  }

  getBurntFee(transaction: ETHTransaction, block: ETHBlock, receipts: ETHReceiptsMap,
    burnAddress: string): ETHTransfer {
    const gasExpense = (block.baseFeePerGas === undefined) ?
      0
      :
      BigInt(Web3Static.parseHexToNumber(block.baseFeePerGas)) *
      BigInt(Web3Static.parseHexToNumber(receipts[transaction.hash].gasUsed))

    return {
      from: transaction.from,
      to: burnAddress,
      value: Number(gasExpense),
      valueExactBase36: gasExpense.toString(36),
      blockNumber: safeCastToNumber(Web3Static.parseHexToNumber(transaction.blockNumber)),
      timestamp: safeCastToNumber(Web3Static.parseHexToNumber(block.timestamp)),
      transactionHash: transaction.hash,
      transactionPosition: safeCastToNumber(Web3Static.parseHexToNumber(transaction.transactionIndex)),
      internalTxPosition: 0,
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
  getMinerFee(transaction: ETHTransaction, block: ETHBlock, receiptsMap: ETHReceiptsMap): ETHTransfer | undefined {
    const baseFeePerGas = (block.baseFeePerGas === undefined) ?
      BigInt(0) : BigInt(Web3Static.parseHexToNumber(block.baseFeePerGas));

    const tipMinerPerGas = BigInt(Web3Static.parseHexToNumber(transaction.gasPrice)) - baseFeePerGas;
    const gasExpense = tipMinerPerGas * BigInt(Web3Static.parseHexToNumber(receiptsMap[transaction.hash].gasUsed));
    if (tipMinerPerGas > 0) {
      return {
        from: transaction.from,
        to: block.miner,
        value: Number(gasExpense),
        valueExactBase36: gasExpense.toString(36),
        blockNumber: safeCastToNumber(Web3Static.parseHexToNumber(transaction.blockNumber)),
        timestamp: safeCastToNumber(Web3Static.parseHexToNumber(block.timestamp)),
        transactionHash: transaction.hash,
        transactionPosition: safeCastToNumber(Web3Static.parseHexToNumber(transaction.transactionIndex)),
        internalTxPosition: 0,
        type: 'fee'
      };
    }
    else {
      return undefined
    }
  }

  getPostLondonForkFees(transaction: ETHTransaction, block: ETHBlock, receiptsMap: ETHReceiptsMap): ETHTransfer[] {
    const result: ETHTransfer[] = [];
    result.push(this.getBurntFee(transaction, block, receiptsMap, BURN_ADDRESS));
    const minerFee = this.getMinerFee(transaction, block, receiptsMap);
    if (minerFee !== undefined) {
      result.push(minerFee)
    }

    return result;
  }

  getFeesFromTransactionsInBlock(block: ETHBlock, blockNumber: number, receipts: ETHReceiptsMap, isETH: boolean): ETHTransfer[] {
    const result: ETHTransfer[] = [];
    block.transactions.forEach((transaction: ETHTransaction | string) => {
      assert(isETHTransaction(transaction), "To get fees, ETH transaction should be expanded and not just the hash.");

      const feeTransfers: ETHTransfer[] =
        isETH && blockNumber >= LONDON_FORK_BLOCK ?
          this.getPostLondonForkFees(transaction, block, receipts) :
          this.getPreLondonForkFees(transaction, block, receipts);

      result.push(...feeTransfers);
    });
    return result;
  }
}
