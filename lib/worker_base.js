"use strict";
const { logger } = require('./logger')

class WorkerBase {
  constructor() {
    // To prevent healthcheck failing during initialization and processing first
    // part of data, we set lastExportTime to current time.
    this.lastExportTime = Date.now()
    this.lastConfirmedBlock = -1
    this.lastExportedBlock = -1
    this.lastPrimaryKey = 0
    this.sleepTimeMsec = 0
  }

  /**
   * To be implemented on inheritance.
   *
   * Upon returning from the method call the implementation should have updated all the member variables of the
   * base class.
   */
  work() {
    throw new Error("'work' method need to be overriden")
  }
  // To be implemented on inheritance.
  init() {
    throw new Error("'init' method need to be overriden")
  }

  /**
   * Should be overwritten depending on blockchain implementation.
   *
   * @returns Number of new requests made towards the Node endpoint. Used for metrics purposes.
   */
  getNewRequestsCount() {
    return 1
  }

  /**
   * @param {Object} Return an object that is to be stored in Zookeeper. Overwrite with the exact fields that are
   * needed to later recover position.
   */
  getLastProcessedPosition() {
    return {
      blockNumber: this.lastExportedBlock,
      primaryKey: this.lastPrimaryKey
    }
  }

  /**
   * Initialize the position from which export should start based on latest stored position in Zookeeper.
   * Would be invoked after init() above.
   *
   * Default implementation for exporters which progress per block number.
   */
  initPosition(lastProcessedPosition) {
    if (lastProcessedPosition) {
      logger.info(`Resuming export from position ${JSON.stringify(lastProcessedPosition)}`)
    } else {
      lastProcessedPosition = {
        blockNumber: parseInt(process.env.START_BLOCK || "-1"),
        primaryKey: parseInt(process.env.START_PRIMARY_KEY || "-1")
      }
      logger.info(`Initialized exporter with initial position ${JSON.stringify(lastProcessedPosition)}`)
    }
    this.lastExportedBlock = lastProcessedPosition.blockNumber
    this.lastPrimaryKey = lastProcessedPosition.primaryKey

    return lastProcessedPosition
  }


  /**
   * A healthcheck metric for the blockchain. Can be a check on the Node and/or other.
   * Should return a Promise.
   */
  healthcheck() {
    return Promise.reject("'healthcheck method needs to be overriden'")
  }
}


module.exports = WorkerBase
