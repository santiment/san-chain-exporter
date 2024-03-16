class TaskManager {
  constructor() {
    this.queue;
    this.taskData = {};
    this.lastTaskIndex = 0;
    this.lastExportedIndex = 0;
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

    this.queue.on('completed', ([index, data]) => {
      this.#handleNewData(index, data);
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
  #handleNewData(index, newTransformedData) {
    this.taskData[index].data = newTransformedData;
    delete this.taskData[index].lambda;
  }

  /**
   * Method for pushing the sequential intervals that are ready.
   * While the loop hits sequential intervals in the taskData property,
   * the data should be pushed to the buffer array. When the while loop hits
   * an undefined (yet) key of taskData, the function should stop.
   * @returns Array of the events' data
   */
  retrieveCompleted() {
    let lastExportedBlock;
    const buffer = [];
    while (this.taskData[this.lastExportedIndex + 1].data) {
      const events = this.taskData[this.lastExportedIndex + 1].data;
      for (const event of events) buffer.push(event);

      lastExportedBlock = this.taskData[this.lastExportedIndex + 1].interval.toBlock;
      delete this.taskData[this.lastExportedIndex + 1];
      this.lastExportedIndex += 1;
    }
    return [lastExportedBlock, buffer];
  }

  /**
   * Takes a `() => worker.work()` function and pushes it
   * into the TaskManager's p-queue.
   * @param {Function} workTask 
   */
  pushToQueue(taskMetadata) {
    this.lastTaskIndex++;
    this.taskData[this.lastTaskIndex] = taskMetadata;
    const taskIndex = this.lastTaskIndex;
    this.queue.add(async () => {
      const result = await taskMetadata.lambda(taskMetadata.interval);
      return [taskIndex, result];
    });
  }
}

module.exports = TaskManager;
