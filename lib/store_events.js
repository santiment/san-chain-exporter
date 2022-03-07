"use strict";

const { logger } = require('./logger')

async function storeEvents(exporter, events) {
  await exporter.beginTransaction();

  try {
    await exporter.sendDataWithKey(events, "primaryKey")
  }
  catch(exception) {
    logger.error("Error storing data to Kafka:" + exception)
    throw exception;
  }

  await exporter.commitTransaction();
}

module.exports = {
  storeEvents
}

