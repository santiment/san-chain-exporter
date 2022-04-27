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
    /*try {
      requests.push(trx);
      if (requests.length >= SEND_BATCH_SIZE || 0 === trxIndex) {
        await exporter.sendDataWithKey(requests, "primaryKey");
        requests.length = 0;
      }
    }
    catch (error) {
      logger.error(`Error storing message to Kafka: ${error}`);
      throw (error);
    }*/
  }

  return result
  //logger.info(`Stored ${trxResults.length} transactions in block range ${trxResults[0].blockHeight}-${trxResults[trxResults.length - 1].blockHeight}`);
}


module.exports = {
  getTransactionsWithKeys
}
