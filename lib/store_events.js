"use strict";

const { logger } = require('./logger')

async function storeEvents(exporter, events) {
  exporter.beginTransaction();

  try {
    await exporter.sendDataWithKey(events, "primaryKey")
  }
  catch(exception) {
    logger.error("Error storing data to Kafka:" + exception)
    throw exception;
  }

  exporter.commitTransaction();
}

module.exports = {
  storeEvents
}

