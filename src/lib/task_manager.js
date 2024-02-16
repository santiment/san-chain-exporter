const { logger } = require('./logger');
const { MAX_TASK_DATA_KEYS } = require('./constants');

class TaskManager {
  constructor() {
    this.queue;
    this.buffer = [];
    this.taskData = {};
    this.consequentTaskIndex = 0;
    this.currentFromBlock;
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
      this.handleNewData(interval, data);
      if (this.consequentTaskIndex >= MAX_TASK_DATA_KEYS) {
        if (!this.queue.isPaused) {
          this.queue.pause();
          logger.info('Pausing the queue...');
        }
      }
    });
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
   * @returns A deep copy of the current TaskManager buffer
   */
  retrieveCompleted() {
    const bufferCopy = [];
    while (this.buffer.length > 0) bufferCopy.push(this.buffer.shift());
    return bufferCopy;
  }

  /**
   * Private method for pushing the sequential intervals that are ready.
   * While the loop hits sequential intervals in the taskData property,
   * the data should be pushed to the buffer property. When the while loop hits
   * an undefined (yet) key of taskData, the function should stop.
   */
  #pushAllEligable() {
    while (this.taskData[this.currentFromBlock]) {
      for (const event of this.taskData[this.currentFromBlock].data) this.buffer.push(event);
      const interval = this.taskData[this.currentFromBlock].toBlock - this.currentFromBlock + 1;
      delete this.taskData[this.currentFromBlock];
      this.currentFromBlock += interval;
    }
  }

  /**
   * On the completion of a task in the p-queue, the task
   * should return an array in the form of [interval, events].
   * These would be set up in the taskData object accordingly in the
   * correct format, after which we use the #pushAllEligable private method
   * to push ready-to-go sequential data into the buffer.
   * @param {object} interval
   * @param {Array} newTransformedData 
   */
  handleNewData(interval, newTransformedData) {
    this.taskData[interval.fromBlock] = { toBlock: interval.toBlock, data: newTransformedData };
    this.#pushAllEligable();
  }

  /**
   * Takes a `() => worker.work()` function and pushes it
   * into the TaskManager's p-queue.
   * @param {Function} workTask 
   */
  pushToQueue(workTask) {
    this.queue.add(workTask);
  }
}

module.exports = TaskManager;
