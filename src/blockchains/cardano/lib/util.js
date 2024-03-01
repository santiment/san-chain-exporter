const { logger } = require('../../../lib/logger');

/**
   * It is expected that transactions for the last included in the batch block are not complete.
   * We discard the non completed block and would re-try it on next iteration.
   */
function discardNotCompletedBlock(transactions) {
  const lastBlockNumber = transactions[transactions.length - 1].block.number;
  let index = transactions.length - 2;
  // Go backwards looking for first occurrence of next to last block
  while (index >= 0 && transactions[index].block.number === lastBlockNumber) {
    --index;
  }

  const numExpectedTransactionsLastBlock = parseInt(transactions[index + 1].block.transactionsCount, 10);
  const numSeenTransactionsLastBlock = transactions.length - index - 1;
  if (numExpectedTransactionsLastBlock !== numSeenTransactionsLastBlock) {
    if (index < 0) {
      const errorMessage = 'Single extracted block is partial. Exporter would not be able to progress. Block number ' +
        `${lastBlockNumber} has ${numExpectedTransactionsLastBlock} but ${numSeenTransactionsLastBlock} were extracted.`;
      throw new Error(errorMessage);
    }
    logger.debug(`Removing ${transactions.length - index - 2} transactions from partial block ${lastBlockNumber}`);
    return transactions.slice(0, index + 1);
  }

  return transactions;
}

function verifyBlockComplete(blockNumber, transactionsSeen, transactionsExpected) {
  const transactionsExpectedCasted = (typeof transactionsExpected === 'string') ?
    parseInt(transactionsExpected, 10) : transactionsExpected;

  if (transactionsSeen !== transactionsExpectedCasted) {
    let strMessage = `Block ${blockNumber} should have ${transactionsExpected}`;
    strMessage += ` transactions but we extracted ${transactionsSeen}`;
    throw new Error(strMessage);
  }
}

function verifyAllBlocksComplete(transactions) {
  let lastBlockNumber = transactions[0].block.number;
  let transactionsInBlock = 1;

  for (let i = 1; i < transactions.length; i++) {
    if (transactions[i].block.number !== lastBlockNumber) {
      // We have finished iterating transactions from the previous block. Check that all transactions are extracted.
      const lastBlock = transactions[i - 1].block;
      verifyBlockComplete(lastBlock.number, transactionsInBlock, lastBlock.transactionsCount);
      transactionsInBlock = 0;
      lastBlockNumber = transactions[i].block.number;
    }
    ++transactionsInBlock;
  }

  const lastBlock = transactions[transactions.length - 1].block;
  verifyBlockComplete(lastBlock.number, transactionsInBlock, lastBlock.transactionsCount);
}

module.exports = {
  discardNotCompletedBlock, verifyAllBlocksComplete
};
