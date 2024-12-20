import { ETHTransfer } from '../eth_types';
const { groupBy } = require('lodash');

export function transactionOrder(a: ETHTransfer, b: ETHTransfer) {
  if (a.blockNumber !== b.blockNumber) {
    return a.blockNumber - b.blockNumber
  }

  const transactionPositionA = (a.transactionPosition !== undefined) ? a.transactionPosition : -1
  const transactionPositionB = (b.transactionPosition !== undefined) ? b.transactionPosition : -1

  if (transactionPositionA !== transactionPositionB) {
    return transactionPositionA - transactionPositionB
  }

  const internalTxPositionA = (a.internalTxPosition !== undefined) ? a.internalTxPosition : -1
  const internalTxPositionB = (b.internalTxPosition !== undefined) ? b.internalTxPosition : -1

  return internalTxPositionA - internalTxPositionB
}

const ethTransferKey = (transfer: ETHTransfer) => `${transfer.blockNumber}-${transfer.transactionHash ?? ''}-${transfer.transactionPosition ?? ''}-${transfer.from}-${transfer.to}`

export function assignInternalTransactionPosition(transfers: ETHTransfer[], groupByKey: (transfer: ETHTransfer) => string = ethTransferKey): void {
  const grouped = groupBy(transfers, groupByKey)
  const values: ETHTransfer[][] = Object.values(grouped)

  values.forEach((transfersSameKey: ETHTransfer[]) => {
    transfersSameKey.forEach((transfer: ETHTransfer, index: number) => {
      transfer.internalTxPosition = index
    })
  })
}

/**
 * Assert data quality guarantees on top of input Transfers
 *
 * Throw an error if:
 * 1. A block number is missing
 * 2. With a block, a transactions number is missing
 *
 * @param transfers Ordered array of transfers
 * @param fromBlock Block number indicating start of expected interval
 * @param toBlock Block number indicating end of expected interval
 */
export function doQAETHTransfers(sortedTransfers: ETHTransfer[], fromBlock: number, toBlock: number) {
  if (fromBlock > toBlock) {
    throw new Error(`Invalid block range: fromBlock (${fromBlock}) is greater than toBlock (${toBlock})`);
  }

  let blockExpected = fromBlock
  let txPositionExpected = 0

  for (const transfer of sortedTransfers) {
    if (transfer.blockNumber < blockExpected) {
      throw new Error(`Transfer for block ${transfer.blockNumber} when ${blockExpected} expected`)
    }
    if (transfer.blockNumber > blockExpected) {
      if (txPositionExpected === 0) {
        // We did not see any transactions for the previous block
        throw new Error(`Transfer data missing for block ${blockExpected} `)
      }
      blockExpected += 1
      txPositionExpected = 0
    }

    if (transfer.transactionPosition !== txPositionExpected) {
      throw new Error(`Transaction at position ${txPositionExpected} is missing in block ${blockExpected}`)
    }
    txPositionExpected += 1
  }

  if (blockExpected != toBlock || txPositionExpected == 0) {
    throw new Error(`Transfer data missing for block ${toBlock}`)
  }
}

export function mergeSortedArrays<T>(sortedArr1: T[], sortedArr2: T[], comparator: (a: T, b: T) => number = (a, b) =>
  a < b ? -1 : a > b ? 1 : 0): T[] {
  const merged: T[] = [];
  let i = 0, j = 0;

  while (i < sortedArr1.length && j < sortedArr2.length) {
    if (comparator(sortedArr1[i], sortedArr2[j]) < 0) {
      merged.push(sortedArr1[i++]);
    } else {
      merged.push(sortedArr2[j++]);
    }
  }

  return merged.concat(sortedArr1.slice(i), sortedArr2.slice(j));
}


