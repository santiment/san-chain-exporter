'use strict';

const { logger } = require('./logger');
const { BLOCKCHAIN } = require('./constants');

async function storeEvents(exporter, events) {
  await exporter.beginTransaction();
  try {
    if (BLOCKCHAIN === 'utxo') {
      await exporter.sendDataWithKey(events, 'height');
    } else {
      await exporter.sendDataWithKey(events, 'primaryKey');
    }
  } catch(exception) {
    logger.error('Error storing data to Kafka:' + exception);
    throw exception;
  }

  await exporter.commitTransaction();
}

module.exports = {
  storeEvents
};
