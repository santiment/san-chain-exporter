'use strict';
const url = require('url');
const { send } = require('micro');
const pkg = require('./package.json');
const metrics = require('./lib/metrics');
const { logger } = require('./lib/logger');
const { Exporter } = require('./lib/kafka_storage');
const { storeEvents } = require('./lib/store_events');
const { BLOCKCHAIN, EXPORT_TIMEOUT_MLS } = require('./lib/constants');
// Dynamically initialize just the needed blockchain worker
const EXPORTER_NAME = process.env.EXPORTER_NAME || pkg.name;
const worker = require(`./blockchains/${BLOCKCHAIN}/${BLOCKCHAIN}_worker`);

var SegfaultHandler = require('segfault-handler');
SegfaultHandler.registerHandler(`${EXPORTER_NAME}_crash.log`);

class Main {
  constructor() {
    // To be set depending on which blockchain worker is configured on runtime
    this.worker = null;
    this.shouldWork = true;
  }

  async init() {
    this.exporter = new Exporter(EXPORTER_NAME, true);
    await this.exporter.connect();
    await this.exporter.initTransactions();
    await this.initWorker();
    metrics.startCollection();
  }

  async workLoop() {
    try {
      const lastRequestStartTime = new Date();
      const events = await this.worker.work();
      metrics.currentBlock.set(this.worker.lastConfirmedBlock);

      // This metric is intended to count the requests towards the Node endpoint.
      // The counting is done inside the worker and we fetch the reult here.
      metrics.requestsCounter.inc(this.worker.getNewRequestsCount());
      metrics.requestsResponseTime.observe(new Date() - lastRequestStartTime);
      metrics.lastExportedBlock.set(this.worker.lastExportedBlock);

      // Get the position to store in Zookeeper as constructed by the worker.
      // Different workers may store different type of position so this is
      // part of the blockchain specific code.
      this.lastProcessedPosition = this.worker.getLastProcessedPosition();

      if (events && events.length > 0) {
        await storeEvents(this.exporter, events);
      }
      await this.exporter.savePosition(this.lastProcessedPosition);
      logger.info(`Progressed to position ${JSON.stringify(this.lastProcessedPosition)}, last confirmed Node block: ${this.worker.lastConfirmedBlock}`);

      const _this = this;
      if (this.shouldWork) {
        setTimeout(function () { _this.workLoop(); }, _this.worker.sleepTimeMsec);
      }
      else {
        this.exporter.disconnect();
      }
    }
    catch (ex) {
      console.error('Error in exporter work loop: ', ex);
      throw ex;
    }
  }

  async initWorker() {
    if (this.worker !== null) {
      throw new Error('Worker is already set');
    }

    this.worker = new worker.worker();
    await this.worker.init(this.exporter, metrics);

    const lastRecoveredPosition = await this.exporter.getLastPosition();
    // Provide the latest recovered from Zookeeper position to the worker. Receive the actual position to start from.
    // This moves the logic of what a proper initial position is to the worker.
    this.lastProcessedPosition = this.worker.initPosition(lastRecoveredPosition);
    await this.exporter.savePosition(this.lastProcessedPosition);

  }

  stop() {
    if (this.shouldWork) {
      logger.info('Triggering graceful exporter stop');
      this.shouldWork = false;
    }
    else {
      logger.info('Exiting immediately');
      // Stopped was already requested - exit immediately
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

const main = new Main();
main.init()
  .then(() => {
    return main.workLoop();
  }, (ex) => {
    console.error('Error initializing exporter: ', ex);
  })
  .then(null, (ex) => {
    console.error('Error in work loop: ', ex);
  });


process.on('SIGINT', () => {
  main.stop();
});


module.exports = async (request, response) => {
  const req = url.parse(request.url, true);

  switch (req.pathname) {
    case '/healthcheck':
      return main.healthcheck()
        .then(() => send(response, 200, 'ok'))
        .catch((err) => {
          logger.error(`Healthcheck failed: ${err.toString()}`);
          send(response, 500, err.toString());
        });
    case '/metrics':
      response.setHeader('Content-Type', metrics.register.contentType);
      return send(response, 200, await metrics.register.metrics());
    default:
      return send(response, 404, 'Not found');
  }
};
