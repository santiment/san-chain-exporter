const { logger } = require('./logger');
const { MAX_TASK_DATA_KEYS, BLOCKCHAIN, START_BLOCK, START_PRIMARY_KEY } = require('./constants');
const { stableSort } = require('../blockchains/erc20/lib/util');
const { transactionOrder } = require('../blockchains/eth/lib/util');

class TaskManager {
  constructor() {
    this.queue;
    this.taskData = {};
    this.lastPrimaryKey;
    this.lastExportedBlock;
    this.consequentTaskIndex = 0;
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
      this.consequentTaskIndex++;
      this.#handleNewData(interval, data);
      this.#maybePauseQueue();
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
   * If the Kafka producer slows down and at the same time we manage
   * to fetch a lot of data, we'll hit an OOM error at some point, because
   * of the `taskData` property getting full.
   * We want to have a border (MAX_TASK_DATA_KEYS), which, if we cross, we'd have the queue
   * pause the task generation for a bit.
   */
  #maybePauseQueue() {
    if (this.consequentTaskIndex >= MAX_TASK_DATA_KEYS) {
      if (!this.queue.isPaused) {
        this.queue.pause();
        logger.info('Pausing the queue...');
      }
    }
  }

  /**
   * When the Kafka Producer finishes with the storage, we'd want to check
   * whether the queue's task generation has been paused, and if positive,
   * start the queue anew.
   */
  restartQueueIfNeeded() {
    if (this.queue.isPaused) {
      this.queue.start();
      this.consequentTaskIndex = 0;
      logger.info('Resuming the queue...');
    }
  }

  /**
   * Helper method for when we push the `taskData` events' data into the buffer
   * @param {Array} events Events data that we get from the current key in the `taskData` property
   * @param {Array} buffer The array that at the end of the primary function would result in the 
   * combined data, accordingly updated with the primary keys
   */
  #updatePrimaryKeysPushToBuffer(events, buffer) {
    for (let i = 0; i < events.length; i++) {
      events[i].primaryKey = this.lastPrimaryKey + i + 1;
      buffer.push(events[i]);
    }
    this.lastPrimaryKey += events.length;
  }

  /**
   * Helper method for checking the blockchain in order to use the correct primary key functionality
   * and push the data into the buffer array.
   * @param {*} events Events data that we get from the current key in the `taskData` property
   * @param {*} buffer The array that at the end of the primary function would result in the 
   * combined data, accordingly updated with the primary keys
   */
  #pushToBuffer(events, buffer) {
    if (BLOCKCHAIN === 'eth') {
      stableSort(events, transactionOrder);
      this.#updatePrimaryKeysPushToBuffer(events, buffer);
    }
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
      this.#pushToBuffer(events, buffer);

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
  pushToQueue(workTask) {
    this.queue.add(workTask);
  }

  /**
   * Same as in the `worker_base.js` module, this is used for the definition of the
   * `lastExportedBlock` and `lastPrimaryKey` properties, according to whether we have a
   * `lastProcessedPosition` from ZooKeeper and if not, use the ones set from the config file
   * or the defaults.
   * @param {*} lastProcessedPosition 
   * @returns An object, either the same from Zookeeper or one generated from the config given
   * to the exporter
   */
  initPosition(lastProcessedPosition) {
    if (lastProcessedPosition) {
      logger.info(`Resuming export from position ${JSON.stringify(lastProcessedPosition)}`);
    } else {
      lastProcessedPosition = {
        blockNumber: START_BLOCK,
        primaryKey: START_PRIMARY_KEY
      };
      logger.info(`Initialized exporter with initial position ${JSON.stringify(lastProcessedPosition)}`);
    }
    this.lastExportedBlock = lastProcessedPosition.blockNumber;
    this.lastPrimaryKey = lastProcessedPosition.primaryKey;

    return lastProcessedPosition;
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

  isChangedLastExportedBlock(lastProcessedBlock) {
    return lastProcessedBlock < this.lastExportedBlock;
  }
}

module.exports = TaskManager;
