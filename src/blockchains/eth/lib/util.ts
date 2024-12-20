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

export function assignInternalTransactionPosition(transfers: ETHTransfer[], groupByKey: (transfer: ETHTransfer) => string = ethTransferKey): ETHTransfer[] {
  const grouped = groupBy(transfers, groupByKey)
  const values: ETHTransfer[][] = Object.values(grouped)

  return values.flatMap((transfersSameKey: ETHTransfer[]) => {
    transfersSameKey.forEach((transfer: ETHTransfer, index: number) => {
      transfer.internalTxPosition = index
    })
    return transfersSameKey
  })
}

