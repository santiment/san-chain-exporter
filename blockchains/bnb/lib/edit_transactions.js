"use strict";


function getTransactionsWithKeys(inputTransactions) {
  const result = [];
  let lastBlockSent = 0;
  let trxIndexInLastBlock = 0;
  // Iterate backwards to fix the ordering. The API has returned them in reverse order.
  for (let trxIndex = inputTransactions.length - 1; trxIndex >= 0; --trxIndex) {
    const trx = inputTransactions[trxIndex];
    // Build the message primary key.
    if (trx.blockHeight > lastBlockSent) {
      lastBlockSent = trx.blockHeight;
      trxIndexInLastBlock = 0;
    }
    else {
      ++trxIndexInLastBlock;
    }
    trx.primaryKey = lastBlockSent.toString() + "-" + trxIndexInLastBlock;

    result.push(trx);
  }

  return result
}


module.exports = {
  getTransactionsWithKeys
}
