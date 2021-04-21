"use strict";

const { stableSort } = require('./util')
const constants = require('./constants')
const { logger } = require('../logger')

function transactionOrder(a, b) {
  const blockDif =  a.blockNumber - b.blockNumber
  if (blockDif != 0) {
    return blockDif
  }
  else {
    return a.logIndex - b.logIndex
  }
}

function extendEventsWithPrimaryKey(events) {
  stableSort(events, transactionOrder)
  const lastEvent = events[events.length -1]
  if (lastEvent.logIndex >= constants.PRIMARY_KEY_MULTIPLIER) {
    logger.error(`An event with log index ${lastEvent.logIndex} is breaking the primaryKey generation logic at block ${lastEvent.blockNumber}`)
  }

  events.forEach( function(event) {
    event.primaryKey = event.blockNumber * constants.PRIMARY_KEY_MULTIPLIER + event.logIndex
  })
}

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
  extendEventsWithPrimaryKey,
  storeEvents
}