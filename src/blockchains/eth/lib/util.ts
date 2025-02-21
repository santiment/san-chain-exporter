import { ETHTransfer } from '../eth_types';
import { EOB } from './end_of_block'
const { groupBy } = require('lodash');

export function transactionOrder(a: ETHTransfer | EOB, b: ETHTransfer | EOB) {
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

export function assertBlocksMatch(groupedTransfers: any, fromBlock: number, toBlock: number) {
  const keys = Object.keys(groupedTransfers)

  // A list of empty blocks, no transfers and no rewards.
  const blocksExceptionList = [15537454]
  let blocksExpected = toBlock - fromBlock + 1

  for (const blockException of blocksExceptionList) {
    if (blockException >= fromBlock && blockException <= toBlock) {
      --blocksExpected;
    }
  }

  if (keys.length !== blocksExpected) {
    throw new Error(`Wrong number of blocks seen. Expected ${blocksExpected} got ${keys.length}.`)
  }

  for (let block = fromBlock; block <= toBlock; block++) {
    if (!blocksExceptionList.includes(block) && !groupedTransfers.hasOwnProperty(block.toString())) {
      throw new Error(`Missing transfers for block ${block}.`)
    }
  }
}


export function assertTransfersWithinBlock(transfersPerBlock: ETHTransfer[]) {
  let expectedTxPosition = 0

  for (const transfer of transfersPerBlock) {
    if (transfer.transactionPosition !== expectedTxPosition) {
      // We allow for multiple transfers withing a transaction. That is why we can see the same transaction position several times.
      if (transfer.transactionPosition !== expectedTxPosition + 1) {
        throw new Error(`Unexpected transaction position for transfer: ${JSON.stringify(transfer)}, expected tx position: ${expectedTxPosition} or ${expectedTxPosition + 1}`);
      }
      expectedTxPosition += 1
    }
  }
}


/**
 * Assert data quality guarantees on top of input Transfers
 *
 * Throw an error if:
 * 1. A block number is missing
 * 2. Within a block, a transactions number is missing
 *
 * @param transfers Ordered array of transfers
 * @param fromBlock Block number indicating start of expected interval
 * @param toBlock Block number indicating end of expected interval
 */
export function checkETHTransfersQuality(sortedTransfers: ETHTransfer[], fromBlock: number, toBlock: number) {
  if (fromBlock > toBlock) {
    throw new Error(`Invalid block range: fromBlock ${fromBlock} is greater than toBlock ${toBlock}`);
  }

  const groupedTransfers = groupBy(sortedTransfers, (transfer: ETHTransfer) => transfer.blockNumber)

  assertBlocksMatch(groupedTransfers, fromBlock, toBlock);

  for (const key of Object.keys(groupedTransfers)) {
    assertTransfersWithinBlock(groupedTransfers[key])
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


