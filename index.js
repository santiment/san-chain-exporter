'use strict';
const url = require('url');
const micro = require('micro');
const pkg = require('./package.json');
const metrics = require('./lib/metrics');
const { logger } = require('./lib/logger');
const { Exporter } = require('./lib/kafka_storage');
const EXPORTER_NAME = process.env.EXPORTER_NAME || pkg.name;
const { stableSort, transactionOrder } = require('./blockchains/eth/lib/util');
const { BLOCKCHAIN, EXPORT_TIMEOUT_MLS, MAX_CONCURRENT_REQUESTS, PQUEUE_MAX_SIZE } = require('./lib/constants');

const worker = require(`./blockchains/${BLOCKCHAIN}/${BLOCKCHAIN}_worker`);

var SegfaultHandler = require('segfault-handler');
const { BLOCK_INTERVAL } = require('./blockchains/eth/lib/constants');
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
    this.lastProcessedPosition = this.worker.initPosition(lastRecoveredPosition);
    this.currentInterval = {
      fromBlock: this.lastProcessedPosition.blockNumber - BLOCK_INTERVAL + 1,
      toBlock: this.lastProcessedPosition.blockNumber
    };
    await this.exporter.savePosition(this.lastProcessedPosition);
  }
// Start from 0 -> currInterval = <-99 0>
//[ <data 0-100> <data 100-200> <data 200-300> <data 300-400> <data 400-500> <data 500-600> ]
//[ <data 500-600> <data 100-200> ] -> check should fail
  #isWorkerSet() {
    if (this.worker) throw new Error('Worker is already set');
  }

  async initWorker() {
    this.#isWorkerSet();

    this.worker = new worker.worker();
    await this.worker.init(this.exporter, metrics);
    await this.handleInitPosition();
    if (BLOCKCHAIN === 'eth') {
      const PQueue = (await import('p-queue')).default;
      this.worker.queue = new PQueue({ concurrency: MAX_CONCURRENT_REQUESTS });
    }
  }

  async init() {
    await this.initExporter(EXPORTER_NAME, true);
    await this.initWorker();
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
    metrics.lastExportedBlock.set(this.worker.lastExportedBlock);
  }

  #inCurrentInterval(blockNumber) {
    return blockNumber >= this.currentInterval.fromBlock && blockNumber <= this.currentInterval.toBlock;
  }

  #inNextInterval(blockNumber) {
    return (
      blockNumber >= this.currentInterval.fromBlock + BLOCK_INTERVAL &&
      blockNumber <= this.currentInterval.toBlock + BLOCK_INTERVAL);
  }

  generateKafkaArray(events) {
    stableSort(events, transactionOrder);
    const kafkaArray = [];
    let initInterval = false;
    while (events.length > 0) {
      if (this.#inCurrentInterval(events[0].blockNumber)) {
        events[0].primaryKey = this.lastPrimaryKey + kafkaArray.length + 1;
        kafkaArray.push(events.shift());
        if (!initInterval) initInterval = true;
      } else if (this.#inNextInterval(events[0].blockNumber) && initInterval) {
        events[0].primaryKey = this.lastPrimaryKey + kafkaArray.length + 1;
        kafkaArray.push(events.shift());
        this.currentInterval.fromBlock += BLOCK_INTERVAL;
        this.currentInterval.toBlock += BLOCK_INTERVAL;
      } else {
        break;
      }
    }
    this.lastPrimaryKey += kafkaArray.length;
    return kafkaArray;
  }

  async workLoop() {
    while (this.shouldWork) {
      if (this.worker.queue.size < PQUEUE_MAX_SIZE) await this.worker.work();
      const kafkaArray = this.generateKafkaArray(this.worker.buffer, this.worker.lastBufferedBlock);
      if (kafkaArray.length > 0) {
        this.lastProcessedPosition = { 
          primaryKey: kafkaArray[kafkaArray.length - 1].primaryKey,
          blockNumber: kafkaArray[kafkaArray.length - 1].blockNumber
        };
        await this.exporter.storeEvents(kafkaArray);
        await this.exporter.savePosition(this.lastProcessedPosition);
        logger.info(`Progressed to position ${JSON.stringify(this.lastProcessedPosition)}, last confirmed Node block: ${this.worker.lastConfirmedBlock}`);
      }
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
    await mainInstance.workLoop();
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
