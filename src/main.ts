'use strict';
import url from 'url';
import { Server, IncomingMessage, ServerResponse } from 'http'
import serve, { send } from 'micro';
const metrics = require('./lib/metrics');
import { logger } from './lib/logger';
import { Exporter } from './lib/kafka_storage';
const EXPORTER_NAME = process.env.EXPORTER_NAME || 'san-chain-exporter';
import { EXPORT_TIMEOUT_MLS } from './lib/constants';
import { constructWorker } from './blockchains/construct_worker'
import constantsBase from './lib/constants';
import { ExporterPosition } from './types'
import { BaseWorker } from './lib/worker_base';

export class Main {
  public worker!: BaseWorker;
  private shouldWork: boolean;
  public exporter!: Exporter;
  public lastProcessedPosition!: ExporterPosition;
  private microServer?: Server;

  constructor() {
    this.shouldWork = true;
  }

  async initExporter(exporterName: string, isTransactions: boolean, kafkaTopic: string) {
    const INIT_EXPORTER_ERR_MSG = 'Error when initializing exporter: ';
    this.exporter = new Exporter(exporterName, isTransactions, kafkaTopic);
    await this.exporter
      .connect()
      .then(() => this.exporter.initTransactions())
      .catch((err) => { throw new Error(`${INIT_EXPORTER_ERR_MSG}${err.message}`); });
  }

  async handleInitPosition() {
    const lastRecoveredPosition = await this.exporter.getLastPosition();
    this.lastProcessedPosition = this.worker.initPosition(lastRecoveredPosition);
    await this.exporter.savePosition(this.lastProcessedPosition);
  }

  #isWorkerSet() {
    if (this.worker) throw new Error('Worker is already set');
  }

  // Hide passwords from settings, we do not want to log authentication data.
  getSettingsWithHiddenPasswords(constants: any): any {
    let copy = JSON.parse(JSON.stringify(constants));
    if (copy.RPC_USERNAME !== undefined) {
      copy.RPC_USERNAME = "*****"
    }
    if (copy.RPC_PASSWORD !== undefined) {
      copy.RPC_PASSWORD = "*****"
    }

    return copy;
  }

  async initWorker(blockchain: string, mergedConstants: any) {
    this.#isWorkerSet();
    logger.info(`Applying the following settings: ${JSON.stringify(this.getSettingsWithHiddenPasswords(mergedConstants))}`);
    this.worker = constructWorker(blockchain, mergedConstants);
    await this.worker.init(this.exporter);
    await this.handleInitPosition();
  }

  async init(blockchain: string) {
    const blockchainSpecificConstants = require(`./blockchains/${blockchain}/lib/constants`);
    const mergedConstants = { ...constantsBase, ...blockchainSpecificConstants };
    await this.initExporter(EXPORTER_NAME, true, mergedConstants.KAFKA_TOPIC);
    await this.initWorker(blockchain, mergedConstants);
    metrics.startCollection();

    this.microServer = new Server(serve(
      (request, response) => microHandler(request, response, this.healthcheck))
    );
    this.microServer.on('error', (err) => {
      logger.error('Monitoring Micro server failure:', err);
      process.exit(1);
    });
    this.microServer.listen(3000, () => {
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
    metrics.requestsResponseTime.observe(Date.now() - this.worker.lastRequestStartTime);
    metrics.lastExportedBlock.set(this.worker.lastExportedBlock);
  }

  async workLoop() {
    while (this.shouldWork) {
      this.worker.lastRequestStartTime = Date.now();
      const events = await this.worker.work();

      this.worker.lastExportTime = Date.now();

      this.updateMetrics();
      this.lastProcessedPosition = this.worker.getLastProcessedPosition();

      if (events && events.length > 0) {
        await this.exporter.storeEvents(events, constantsBase.WRITE_SIGNAL_RECORDS_KAFKA);
      }
      await this.exporter.savePosition(this.lastProcessedPosition);
      logger.info(`Progressed to position ${JSON.stringify(this.lastProcessedPosition)}, last confirmed Node block: ${this.worker.lastConfirmedBlock}`);

      if (this.shouldWork) {
        await new Promise((resolve) => setTimeout(resolve, this.worker.sleepTimeMsec));
      }
    }
  }

  async disconnect() {
    // This call should be refactored to work with async/await
    if (this.exporter !== undefined) {
      this.exporter.disconnect();
    }
    if (this.microServer !== undefined) {
      this.microServer.close();
    }
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

  healthcheckKafka(): Promise<void> {
    if (this.exporter.isConnected()) {
      return Promise.resolve();
    } else {
      return Promise.reject('Kafka client is not connected to any brokers');
    }
  }

  healthcheckExportTimeout(): Promise<string | void> {
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

  healthcheck(): Promise<string | void> {
    return this.healthcheckKafka()
      .then(() => this.healthcheckExportTimeout());
  }
}


const microHandler = async (request: IncomingMessage, response: ServerResponse,
  healthcheckFun: () => Promise<string | void>) => {
  let requestURL: string;

  if (request.url !== undefined) {
    requestURL = request.url;
  }
  else {
    throw Error('URL needs to be set in micro call')
  }

  const req = url.parse(requestURL, true);

  switch (req.pathname) {
    case '/healthcheck':
      return healthcheckFun()
        .then(() => send(response, 200, 'ok'))
        .catch((err: any) => {
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



