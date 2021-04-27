"use strict";

class WorkerBase {
  constructor() {
    // To prevent healthcheck failing during initialization and processing first
    // part of data, we set lastExportTime to current time.
    this.lastExportTime = Date.now()
    this.lastConfirmedBlock = 0
    this.lastExportedBlock = 0
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
   * A healthcheck metric for the blockchain. Can be a check on the Node and/or other.
   * Should return a Promise.
   */
  healthcheck() {
    return Promise.reject("'healthcheck method needs to be overriden'")
  }
}


module.exports = WorkerBase
