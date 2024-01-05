const { cloneDeep } = require('lodash');


class TaskManager {
  constructor() {
    this.taskData = {};
    this.queue;
    this.buffer = [];
    this.taskIndex = 0;
    this.lastPushedToBuffer = 0;
  }

  async initQueue(maxConcurrentRequests) {
    const PQueue = (await import('p-queue')).default;
    this.queue = new PQueue({ concurrency: maxConcurrentRequests });
    this.queue.on('completed', (data) => this.handleNewData(data));
  }

  static async create(maxConcurrentRequests) {
    const tm = new TaskManager();
    await tm.initQueue(maxConcurrentRequests);
    return tm;
  }

  retrieveCompleted() {
    const bufferCopy = [];
    while (this.buffer.length > 0) bufferCopy.push(this.buffer.shift());
    return bufferCopy;
  }

  #pushAllEligable() {
    while (this.taskData[this.lastPushedToBuffer]) {
      for (const data of this.taskData[this.lastPushedToBuffer]) this.buffer.push(data);
      delete this.taskData[this.lastPushedToBuffer];
      this.lastPushedToBuffer++;
    }
  }

  handleNewData([key, newTransformedData]) {
    this.taskData[key] = newTransformedData;
    this.#pushAllEligable();
  }

  pushToQueue(worker) {
    this.queue.add(async () => {
      const result = await worker.work();
      const currIndex = cloneDeep(this.taskIndex);
      return [currIndex, result];
    });
    this.taskIndex++;
  }
}

module.exports = TaskManager;
