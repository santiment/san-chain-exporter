const { logger } = require('../../../lib/logger')

/**
   * It is expected that transactions for the last included in the batch block are not complete.
   * We discard the non completed block and would re-try it on next iteration.
   */
function discardNotCompletedBlock(transactions) {
  const lastBlockNumber = transactions[transactions.length - 1].block.number
  let index = transactions.length - 2
  while (index >= 0 && transactions[index].block.number == lastBlockNumber) {
    --index
  }

  if (transactions[index + 1].block.transactionsCount != transactions.length - index - 1) {
    if (index < 0) {
      throw new Error(`Single extracted block is partial. Exporter would not be able to progress.
          Block number is ${lastBlockNumber} it has ${transactions[0].block.transactionsCount} but only
          ${transactions.length - 1} were extracted.`)
    }
    logger.debug(`Removing ${transactions.length - index - 1} transactions from partial block ${lastBlockNumber}`)
    return transactions.slice(0, index + 1)
  }

  return transactions
}

function verifyAllBlocksComplete(transactions) {
  let lastBlockNumber = transactions[0].block.number
  let transactionsInBlock = 1

  for (let i = 1; i < transactions.length; i++) {
    if (transactions[i].block.number != lastBlockNumber) {
      // Check that all transactions are extracted
      if (transactionsInBlock != transactions[i - 1].block.transactionsCount) {
        throw new Error(`The block ${lastBlockNumber} has ${transactions[i - 1].block.transactionsCount}
            transactions but we extracted ${transactionsInBlock} transactions`)
      }
      transactionsInBlock = 0
      lastBlockNumber = transactions[i].block.number
    }
    ++transactionsInBlock
  }

  const expectedTrxInLastBlock = transactions[transactions.length - 1].block.transactionsCount
  if (expectedTrxInLastBlock != transactionsInBlock) {
    throw new Error(`The block ${lastBlockNumber} has ${expectedTrxInLastBlock}
          transactions but we extracted ${transactionsInBlock} transactions`)
  }
}
module.exports = {
  discardNotCompletedBlock, verifyAllBlocksComplete
}
