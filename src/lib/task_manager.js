class TaskManager {
  constructor() {
    this.queue;
    this.taskData = {};
    this.lastPrimaryKey;
    this.lastExportedBlock;
  }

  /**
   * Method for creating a TaskManager instance.
   * @param {number} maxConcurrentRequests Number of maximum concurrent tasks that should work at the same time
   * @returns A TaskManager instance
   */
  static async create(maxConcurrentRequests) {
    const tm = new TaskManager();
    await tm.initQueue(maxConcurrentRequests);
    return tm;
  }

  /**
   * Method for initialization of the queue. It's done in such a way,
   * because the p-queue package itself does not support CommonJS type importing.
   * @param {number} maxConcurrentRequests Number of maximum concurrent tasks that should work at the same time
   */
  async initQueue(maxConcurrentRequests) {
    const PQueue = (await import('p-queue')).default;
    this.queue = new PQueue({ concurrency: maxConcurrentRequests });

    this.queue.on('completed', ([interval, data]) => {
      this.#handleNewData(interval, data);
    });
  }

  /**
   * On the completion of a task in the p-queue, the task
   * should return an array in the form of [interval, events].
   * These would be set up in the taskData object accordingly in the
   * correct format
   * @param {object} interval
   * @param {Array} newTransformedData 
   */
  #handleNewData(interval, newTransformedData) {
    this.taskData[interval.fromBlock] = { toBlock: interval.toBlock, data: newTransformedData };
  }


  /**
   * Method for pushing the sequential intervals that are ready.
   * While the loop hits sequential intervals in the taskData property,
   * the data should be pushed to the buffer array. When the while loop hits
   * an undefined (yet) key of taskData, the function should stop.
   * @returns Array of the events' data
   */
  retrieveCompleted() {
    const buffer = [];
    while (this.taskData[this.lastExportedBlock + 1]) {
      const events = this.taskData[this.lastExportedBlock + 1].data;
      for (const event of events) buffer.push(event);

      const newLastExportedBlock = this.taskData[this.lastExportedBlock + 1].toBlock;
      delete this.taskData[this.lastExportedBlock + 1];
      this.lastExportedBlock = newLastExportedBlock;
    }
    return buffer;
  }

  /**
   * Takes a `() => worker.work()` function and pushes it
   * into the TaskManager's p-queue.
   * @param {Function} workTask 
   */
  pushToQueue(interval, workTask) {
    // this.queue.add()
    this.queue.add(workTask);
  }

  /**
   * Same as in the `worker_base.js` module, this is used for the definition of the
   * `lastExportedBlock` and `lastPrimaryKey` properties, according to whether we have a
   * `lastProcessedPosition` from ZooKeeper and if not, use the ones set from the config file
   * or the defaults.
   * @param {object} lastProcessedPosition
   */
  initFromLastPosition(lastProcessedPosition) {
    this.lastExportedBlock = lastProcessedPosition.blockNumber;
    this.lastPrimaryKey = lastProcessedPosition.primaryKey;
  }

  /**
   * Gets the object, made by taking the lastExportedBlock and lastPrimaryKey variables.
   * Used when updating the position of the exporter in ZooKeeper.
   * @returns An object of the last exported block and last used primary key
   */
  getLastProcessedPosition() {
    return {
      blockNumber: this.lastExportedBlock,
      primaryKey: this.lastPrimaryKey
    };
  }

  /**
   * @param {number} bufferLength The length of the buffer of updated events
   */
  updateLastPrimaryKey(bufferLength) {
    this.lastPrimaryKey += bufferLength;
  }

  isChangedLastExportedBlock(lastProcessedBlock) {
    return lastProcessedBlock < this.lastExportedBlock;
  }
}

module.exports = TaskManager;
