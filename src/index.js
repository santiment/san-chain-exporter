'use strict';
const url = require('url');
const micro = require('micro');
const metrics = require('./lib/metrics');
const { logger } = require('./lib/logger');
const TaskManager = require('./lib/task_manager');
const { Exporter } = require('./lib/kafka_storage');
const { BLOCKCHAIN, EXPORT_TIMEOUT_MLS } = require('./lib/constants');
const EXPORTER_NAME = process.env.EXPORTER_NAME || 'san-chain-exporter';
const { BLOCKCHAIN, EXPORT_TIMEOUT_MLS, MAX_CONCURRENT_REQUESTS } = require('./lib/constants');
const worker = require(`./blockchains/${BLOCKCHAIN}/${BLOCKCHAIN}_worker`);
const constants = require(`./blockchains/${BLOCKCHAIN}/lib/constants`);
const constantsBase = require('./lib/constants');

var SegfaultHandler = require('segfault-handler');
SegfaultHandler.registerHandler(`${EXPORTER_NAME}_crash.log`);

class Main {
  constructor() {
    this.worker = null;
    this.shouldWork = true;
  }

  async initExporter(exporterName, isTransactions) {
    const INIT_EXPORTER_ERR_MSG = 'Error when initializing exporter: ';
    this.exporter = new Exporter(exporterName, isTransactions);
    await this.exporter
      .connect()
      .then(() => this.exporter.initTransactions())
      .catch((err) => { throw new Error(`${INIT_EXPORTER_ERR_MSG}${err.message}`); });
  }

  async handleInitPosition() {
    const lastRecoveredPosition = await this.exporter.getLastPosition();
    if (BLOCKCHAIN === 'eth') {
      this.lastProcessedPosition = this.taskManager.initPosition(lastRecoveredPosition);
      this.worker.lastQueuedBlock = this.lastProcessedPosition.blockNumber;
    } else {
      this.lastProcessedPosition = this.worker.initPosition(lastRecoveredPosition);
    }
    await this.exporter.savePosition(this.lastProcessedPosition);
  }

  async initTaskManager() {
    this.taskManager = await TaskManager.create(MAX_CONCURRENT_REQUESTS);
  }

  #isWorkerSet() {
    if (this.worker) throw new Error('Worker is already set');
  }

  async initWorker() {
    this.#isWorkerSet();
    const mergedConstants = { ...constantsBase, ...constants };
    this.worker = new worker.worker(mergedConstants);
    await this.worker.init(this.exporter);
  }

  async init() {
    await this.initExporter(EXPORTER_NAME, true);
    await this.initWorker();
    if (BLOCKCHAIN === 'eth') await this.initTaskManager(this.lastProcessedPosition);
    await this.handleInitPosition();

    metrics.startCollection();

    this.microServer = micro(microHandler);
    this.microServer.listen(3000, err => {
      if (err) {
        logger.error('Failed to start Micro server:', err);
        process.exit(1);
      }
      logger.info('Micro Server started on port 3000');
    });
  }

  /**
   * The metrics are intended to monitor different aspects of the exporter's work
   * such as the number of requests and the response time.
  */
  updateMetrics() {
    metrics.currentBlock.set(this.worker.lastConfirmedBlock);
    metrics.requestsCounter.inc(this.worker.getNewRequestsCount());
    metrics.requestsResponseTime.observe(new Date() - this.worker.lastRequestStartTime);
    if (BLOCKCHAIN === 'eth') {
      metrics.lastExportedBlock.set(this.taskManager.lastExportedBlock);
    } else {
      metrics.lastExportedBlock.set(this.worker.lastExportedBlock);
    }
  }

  async waitOnStoreEvents() {
    const buffer = this.taskManager.retrieveCompleted();
    if (buffer.length > 0) {
      await this.exporter.storeEvents(buffer);
    }

    this.taskManager.restartQueueIfNeeded();
  }

  async updatePosition() {
    if (this.taskManager.isChangedLastExportedBlock(this.lastProcessedPosition.blockNumber)) {
      this.lastProcessedPosition = this.taskManager.getLastProcessedPosition();
      await this.exporter.savePosition(this.lastProcessedPosition);
      logger.info(`Progressed to position ${JSON.stringify(this.lastProcessedPosition)}, last confirmed Node block: ${this.worker.lastConfirmedBlock}`);
    }
  }

  async workLoop() {
    while (this.shouldWork) {
      this.worker.lastRequestStartTime = new Date();
      const events = await this.worker.work();

      this.worker.lastExportTime = Date.now();

      this.updateMetrics();
      this.lastProcessedPosition = this.worker.getLastProcessedPosition();

      if (events && events.length > 0) {
        await this.exporter.storeEvents(events);
      }
      await this.exporter.savePosition(this.lastProcessedPosition);
      logger.info(`Progressed to position ${JSON.stringify(this.lastProcessedPosition)}, last confirmed Node block: ${this.worker.lastConfirmedBlock}`);

      if (this.shouldWork) {
        await new Promise((resolve) => setTimeout(resolve, this.worker.sleepTimeMsec));
      }
    }
  }

  async workLoopV2() {
    while (this.shouldWork) {
      await this.taskManager.queue.onSizeLessThan(constantsBase.PQUEUE_MAX_SIZE);
      this.taskManager.pushToQueue(() => this.worker.work().catch(err => {
        logger.error(err.toString());
        this.shouldWork = false;
      }));
      this.worker.lastRequestStartTime = new Date();
      this.worker.lastExportTime = Date.now();

      await this.waitOnStoreEvents();
      await this.updatePosition();
      this.updateMetrics();

      if (this.shouldWork) {
        await new Promise((resolve) => setTimeout(resolve, this.worker.sleepTimeMsec));
      }
    }
  }

  async disconnect() {
    // This call should be refactored to work with async/await
    this.exporter.disconnect();
    await this.microServer.close();
  }

  stop() {
    if (this.shouldWork) {
      logger.info('Triggering graceful exporter stop');
      this.shouldWork = false;
    }
    else {
      logger.info('Exiting immediately');
      process.exit();
    }
  }

  healthcheckKafka() {
    if (this.exporter.producer.isConnected()) {
      return Promise.resolve();
    } else {
      return Promise.reject('Kafka client is not connected to any brokers');
    }
  }

  healthcheckExportTimeout() {
    const timeFromLastExport = Date.now() - this.worker.lastExportTime;
    const isExportTimeoutExceeded = timeFromLastExport > EXPORT_TIMEOUT_MLS;
    if (isExportTimeoutExceeded) {
      const errorMessage = `Time from the last export ${timeFromLastExport}ms exceeded limit ` +
        `${EXPORT_TIMEOUT_MLS}ms. Node last block is ${this.worker.lastConfirmedBlock}.`;
      return Promise.reject(errorMessage);
    } else {
      return Promise.resolve();
    }
  }

  healthcheck() {
    return this.healthcheckKafka()
      .then(() => this.healthcheckExportTimeout());
  }
}

const mainInstance = new Main();

process.on('SIGINT', () => {
  mainInstance.stop();
});
process.on('SIGTERM', () => {
  mainInstance.stop();
});


const microHandler = async (request, response) => {
  const req = url.parse(request.url, true);

  switch (req.pathname) {
    case '/healthcheck':
      return mainInstance.healthcheck()
        .then(() => micro.send(response, 200, 'ok'))
        .catch((err) => {
          logger.error(`Healthcheck failed: ${err.toString()}`);
          micro.send(response, 500, err.toString());
        });
    case '/metrics':
      response.setHeader('Content-Type', metrics.register.contentType);
      return micro.send(response, 200, await metrics.register.metrics());
    default:
      return micro.send(response, 404, 'Not found');
  }
};

async function main() {
  try {
    await mainInstance.init();
  } catch (err) {
    logger.error(err.stack);
    throw new Error(`Error initializing exporter: ${err.message}`);
  }
  try {
    if (BLOCKCHAIN === 'eth') {
      await mainInstance.workLoopV2();
    } else {
      await mainInstance.workLoop();
    }
    await mainInstance.disconnect();
    logger.info('Bye!');
  } catch (err) {
    logger.error(err.stack);
    throw new Error(`Error in exporter work loop: ${err.message}`);
  }
}

!process.env.TEST_ENV ? main() : null;

module.exports = {
  main,
  Main
};
