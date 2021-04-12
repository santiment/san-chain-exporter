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

async function work(exporter,
                    ethNodeLastBlock,
                    getPastEventsFunction,
                    metrics,
                    lastProcessedPosition) {
  const currentBlock = ethNodeLastBlock - constants.CONFIRMATIONS
  metrics.currentBlock.set(currentBlock)

  while (lastProcessedPosition.blockNumber < currentBlock) {
    const toBlock = Math.min(lastProcessedPosition.blockNumber + constants.BLOCK_INTERVAL, currentBlock)
    logger.info(`Fetching transfer events for interval ${lastProcessedPosition.blockNumber}:${toBlock}`)
    metrics.requestsCounter.inc();

    const requestStartTime = new Date();
    const events = await getPastEventsFunction(lastProcessedPosition.blockNumber + 1, toBlock);

    metrics.requestsResponseTime.observe(new Date() - requestStartTime);

    if (events.length > 0) {
      await exporter.beginTransaction();

      stableSort(events, transactionOrder)
      const lastEvent = events[events.length -1]
      if (lastEvent.logIndex >= constants.PRIMARY_KEY_MULTIPLIER) {
        logger.error(`An event with log index ${lastEvent.logIndex} is breaking the primaryKey generation logic at block ${lastEvent.blockNumber}`)
      }
      for (let i = 0; i < events.length; i++) {
        const event = events[i]
        event.primaryKey = event.blockNumber * constants.PRIMARY_KEY_MULTIPLIER + event.logIndex
      }

      logger.info(`Storing and setting primary keys ${events.length} messages for blocks ${lastProcessedPosition.blockNumber + 1}:${toBlock}`)

      try {
        await exporter.sendDataWithKey(events, "primaryKey")
      }
      catch(exception) {
        logger.error("Error storing data to Kafka:" + exception)
        throw exception;
      }

      lastProcessedPosition.primaryKey = lastEvent.primaryKey
      lastProcessedPosition.lastExportTime = Date.now();
      await exporter.commitTransaction();
    }

    lastProcessedPosition.blockNumber = toBlock
    metrics.lastExportedBlock.set(lastProcessedPosition.blockNumber);
    await exporter.savePosition(lastProcessedPosition)
  }
}

module.exports = {
  work
}