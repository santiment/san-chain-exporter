const { BLOCK_INTERVAL } = require('./constants');//TODO: Remove from blockchains constants

class TaskManager {
  constructor(startPosition) {
    this.map = {};
    this.queue;
    this.buffer = [];
    this.currentInterval = {
      fromBlock: startPosition.fromBlock + BLOCK_INTERVAL,
      toBlock: startPosition.toBlock + BLOCK_INTERVAL
    };
  }

  async initPQueue() {
    this.queue = (await import('p-queue')).default;
    this.queue.on('complete', (data) => {
      data.forEach((dataVal) => this.handleNewData(dataVal));
    });
  }

  #incrementCurrentInterval() {
    this.currentInterval.fromBlock += BLOCK_INTERVAL;
    this.currentInterval.toBlock += BLOCK_INTERVAL;
  }

  #pushAllEligable() {
    while (this.map[this.currentInterval]) {
      this.buffer.push(...this.map[this.currentInterval]);
      delete this.map[this.currentInterval];
      this.#incrementCurrentInterval();
    }
  }

  handleNewData(newTransformedData, interval) {
    this.map[interval] = newTransformedData;
    this.#pushAllEligable();
  }

  pushToQueue(task) {
    this.queue.add(task());
  }
}

module.exports = TaskManager;
