import { ETHTransfer } from '../eth_types';
import { EOB } from './end_of_block'
import { HTTPClientInterface } from '../../../types';
import { fetchBlocks } from './fetch_data';
import { logger } from '../../../lib/logger';
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

const ethTransferKey = (transfer: ETHTransfer) => `${transfer.blockNumber}-${transfer.transactionPosition ?? ''}`

export function assignInternalTransactionPosition(transfers: ETHTransfer[], groupByKey: (transfer: ETHTransfer) => string = ethTransferKey): void {
  const grouped = groupBy(transfers, groupByKey)
  const values: ETHTransfer[][] = Object.values(grouped)

  values.forEach((transfersSameKey: ETHTransfer[]) => {
    transfersSameKey.forEach((transfer: ETHTransfer, index: number) => {
      transfer.internalTxPosition = index
    })
  })
}

export async function assertBlocksMatch(groupedTransfers: any, fromBlock: number, toBlock: number,
  ethClientVerification: HTTPClientInterface) {
  const keys = Object.keys(groupedTransfers)

  for (let block = fromBlock; block <= toBlock; block++) {
    if (!groupedTransfers.hasOwnProperty(block.toString())) {
      const blocksCheck = await fetchBlocks(ethClientVerification, block, block, false)
      const blockData = blocksCheck?.get?.(block)
      if (!blockData || !Array.isArray(blocksCheck.get(block)?.transactions)) {
        throw new Error(`Empty result querying verify node for block ${block}.`)
      }
      if (blockData.transactions.length !== 0) {
        throw new Error(`Missing transfers for block ${block} from main node. Verify node has data.`)
      }
      else {
        logger.info(`Block ${block} has no data in both main and verify nodes`)
      }
    }
  }

  const blocksExpected = toBlock - fromBlock + 1
  if (keys.length > blocksExpected) {
    throw new Error(`Node returns more blocks than expected. Expected ${blocksExpected} got ${keys.length}.`)
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
 * @param ethClientVerification Extra ETH client service to check if a missing block is returned from the main service
 */
export async function checkETHTransfersQuality(sortedTransfers: ETHTransfer[], fromBlock: number, toBlock: number,
  ethClientVerification: HTTPClientInterface) {
  if (fromBlock > toBlock) {
    throw new Error(`Invalid block range: fromBlock ${fromBlock} is greater than toBlock ${toBlock}`);
  }

  const groupedTransfers = groupBy(sortedTransfers, (transfer: ETHTransfer) => transfer.blockNumber)

  await assertBlocksMatch(groupedTransfers, fromBlock, toBlock, ethClientVerification);

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


