'use strict';

const { logger } = require('./logger');
const { BLOCKCHAIN } = require('./constants');

async function storeEvents(exporter, events) {
  await exporter.beginTransaction();
  try {
    if (BLOCKCHAIN === 'utxo') {
      await exporter.sendDataWithKey(events, 'height');
    } else if (BLOCKCHAIN === 'receipts') {
      await exporter.sendDataWithKey(events, 'transactionHash');
    } else {
      await exporter.sendDataWithKey(events, 'primaryKey');
    }
    await exporter.commitTransaction();
  } catch(exception) {
    logger.error('Error storing data to Kafka:' + exception);
    exporter.abortTransaction();
    throw exception;
  }
}

module.exports = {
  storeEvents
};
