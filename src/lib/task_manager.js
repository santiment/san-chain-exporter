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
   * Handles the values that the queue task has returned,
   * deletes the function for the task as it's not needed anymore.
   * @param {number} index
   * @param {Array} newTransformedData 
   */
  #handleNewData(index, newTransformedData) {
    this.taskData[index].data = newTransformedData;
    delete this.taskData[index].lambda;
  }

  /**
   * Method for pushing the sequential indeces that are ready.
   * While the loop hits sequential indeces in the taskData property,
   * the data should be pushed to the buffer array. When the while loop hits
   * an undefined (yet) key of taskData, the function should stop.
   * @returns Array of the last exported block, along with the array of the events' data
   */
  retrieveCompleted() {
    let lastExportedBlock;
    const buffer = [];
    while (this.taskData[this.lastExportedIndex + 1] && this.taskData[this.lastExportedIndex + 1].data) {
      const events = this.taskData[this.lastExportedIndex + 1].data;
      for (const event of events) buffer.push(event);

      lastExportedBlock = this.taskData[this.lastExportedIndex + 1].interval.toBlock;
      delete this.taskData[this.lastExportedIndex + 1];
      this.lastExportedIndex += 1;
    }
    return [lastExportedBlock, buffer];
  }

  /**
   * Method for generating a function, using the taskMetadata object
   * and pushing it into the p-queue. The method also updates the
   * taskData class property with the task indeces as keys and the taskMetadata object
   * as values.
   * @param {object} taskMetadata Object with interval and lambda properties
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
