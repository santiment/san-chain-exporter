"use strict";

const { stableSort } = require('./util')
const constants = require('./constants')
const { logger } = require('../../../lib/logger')

function transactionOrder(a, b) {
  const blockDif =  a.blockNumber - b.blockNumber
  if (blockDif != 0) {
    return blockDif
  }
  else {
    return a.logIndex - b.logIndex
  }
}

function extendEventsWithPrimaryKey(events, overwritten_events) {
  stableSort(events, transactionOrder)
  const lastEvent = events[events.length -1]
  if (lastEvent.logIndex + overwritten_events.length >= constants.PRIMARY_KEY_MULTIPLIER) {
    logger.error(`An event with log index ${lastEvent.logIndex} is breaking the primaryKey generation logic at block `
     + `${lastEvent.blockNumber}. There are ${overwritten_events.length} overwritten events.`)
  }

  events.forEach( function(event) {
    event.primaryKey = event.blockNumber * constants.PRIMARY_KEY_MULTIPLIER + event.logIndex
  })
  // As the overwritten events are copies of the main events, they would have the same logIndex. To generate unique primary keys,
  // the primary keys of ovewritten events start after the biggest primary key of the main events and increase by 1.
  let lastLogIndex = lastEvent.logIndex
  overwritten_events.forEach( function(event) {
    lastLogIndex += 1
    event.primaryKey = event.blockNumber * constants.PRIMARY_KEY_MULTIPLIER + lastLogIndex
  })
}

module.exports = {
  extendEventsWithPrimaryKey
}
