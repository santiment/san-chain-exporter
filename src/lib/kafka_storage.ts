import crypto from 'crypto';
import Kafka, { LibrdKafkaError, ProducerGlobalConfig } from 'node-rdkafka';
import { BLOCKCHAIN } from './constants';
import ZookeeperClientAsync from './zookeeper_client_async';
import { log_according_to_syslog_level, logger, SYSLOG_LOG_LEVEL } from './logger';


const ZOOKEEPER_URL: string = process.env.ZOOKEEPER_URL || 'localhost:2181';
const ZOOKEEPER_RETRIES: number = parseInt(process.env.ZOOKEEPER_RETRIES || '0');
const ZOOKEEPER_SPIN_DELAY: number = parseInt(process.env.ZOOKEEPER_SPIN_DELAY || '1000');
const ZOOKEEPER_SESSION_TIMEOUT: number = parseInt(process.env.ZOOKEEPER_SESSION_TIMEOUT || '30000');

const FORMAT_HEADER: string = 'format=json;';
const RDKAFKA_DEBUG: string | null = process.env.RDKAFKA_DEBUG || null;
const KAFKA_URL: string = process.env.KAFKA_URL || 'localhost:9092';
const KAFKA_COMPRESSION_CODEC: string = process.env.KAFKA_COMPRESSION_CODEC || 'lz4';
const KAFKA_FLUSH_TIMEOUT: number = parseInt(process.env.KAFKA_FLUSH_TIMEOUT || '10000');
const BUFFERING_MAX_MESSAGES: number = parseInt(process.env.BUFFERING_MAX_MESSAGES || '150000');
const TRANSACTIONS_TIMEOUT_MS: number = parseInt(process.env.TRANSACTIONS_TIMEOUT_MS || '60000');
const KAFKA_MESSAGE_MAX_BYTES: number = parseInt(process.env.KAFKA_MESSAGE_MAX_BYTES || '10485760');

process.on('unhandledRejection', (reason: unknown, p: Promise<unknown>): void => {
  // Otherwise unhandled promises are not possible to trace with the information logged
  if (reason instanceof Error) {
    logger.error('Unhandled Rejection at: ', p, 'reason:', reason, 'error stack:', (reason as Error).stack);
  }
  else {
    logger.error('Unhandled Rejection at: ', p, 'reason:', reason);
  }
  process.exit(1);
});

/**
 * A class to pick partition for an event.
 */
class Partitioner {
  private hashFunction: ((value: object) => number) | null;
  private partitionCount: number = -1;

  constructor() {
    this.hashFunction = null;
  }

  async init(hashFunction: ((value: object) => number), topicName: string, producer: Kafka.Producer) {
    this.hashFunction = hashFunction;
    this.partitionCount = await this.#findPartitionCount(topicName, producer);
    if (this.partitionCount <= 0) {
      throw new Error('Partition count should be > 0');
    }
  }

  async #findPartitionCount(topicName: string, producer: Kafka.Producer) {
    // We depend on the producer already being connected
    logger.info(`Finding partition count for topic ${topicName}`);
    const metadata: Kafka.Metadata = await new Promise((resolve, reject) => {
      producer.getMetadata({ topic: topicName, timeout: 10000 }, (err: Kafka.LibrdKafkaError, metadata: Kafka.Metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata);
        }
      });
    });

    // Find the topic's metadata and extract the number of partitions
    const topicMetadata = metadata.topics.find(t => t.name === topicName);
    if (topicMetadata) {
      logger.info(`Topic ${topicName} is found to have ${topicMetadata.partitions.length} partitions`);
      return topicMetadata.partitions.length;
    } else {
      throw new Error(`Topic "${topicName}" not found!`);
    }
  }

  /**
   * Return partition number for the event argument
   * @param {object} event An event to be written to Kafka
   * @returns {number} A partition number chosen for this event
   */
  getPartitionNumber(event: object) {
    if (!this.hashFunction) {
      // Should be left to 'null' if we want library to choose partition for us
      throw new Error('Hash function in partitioner is not initialized');
    }

    return this.hashFunction(event) % this.partitionCount;
  }

  getPartitionCount() {
    return this.partitionCount;
  }
}

function castCompression(compression: string): 'none' | 'gzip' | 'snappy' | 'lz4' | 'zstd' {
  const validCompressions = ['none', 'gzip', 'snappy', 'lz4', 'zstd'];
  if (validCompressions.includes(compression)) {
    return compression as 'none' | 'gzip' | 'snappy' | 'lz4' | 'zstd';
  }
  throw new Error(`Invalid compression value: ${compression}`);
}

export class Exporter {
  private readonly exporter_name: string;
  private readonly producer: Kafka.Producer;
  private readonly topicName: string;
  private readonly zookeeperClient: ZookeeperClientAsync;
  private partitioner: Partitioner | null;

  constructor(exporter_name: string, transactional: boolean, topicName: string, disableStickyPartition: boolean = false) {
    this.exporter_name = exporter_name;

    const producer_settings: ProducerGlobalConfig = {
      'metadata.broker.list': KAFKA_URL,
      'client.id': this.exporter_name,
      'compression.codec': castCompression(KAFKA_COMPRESSION_CODEC),
      'queue.buffering.max.messages': BUFFERING_MAX_MESSAGES,
      'message.max.bytes': KAFKA_MESSAGE_MAX_BYTES,
      'dr_cb': true,
      'log_level': SYSLOG_LOG_LEVEL
    };

    if (RDKAFKA_DEBUG) {
      producer_settings['debug'] = RDKAFKA_DEBUG;
    }

    this.topicName = topicName;

    if (transactional) {
      const uniqueIdentifier = crypto.randomBytes(16).toString('hex');
      const timestamp = Date.now();
      const transactionalID = `${this.topicName}-${uniqueIdentifier}-${timestamp}`;
      producer_settings['transactional.id'] = transactionalID;
      producer_settings['enable.idempotence'] = true;
    }

    if (disableStickyPartition) {
      producer_settings['sticky.partitioning.linger.ms'] = 0;
    }

    this.producer = new Kafka.Producer(producer_settings);

    this.producer.on('event.log', function (log) {
      log_according_to_syslog_level(log.severity, log.fac, log.message);
    });

    this.zookeeperClient = new ZookeeperClientAsync(ZOOKEEPER_URL,
      {
        sessionTimeout: ZOOKEEPER_SESSION_TIMEOUT,
        spinDelay: ZOOKEEPER_SPIN_DELAY,
        retries: ZOOKEEPER_RETRIES
      }
    );

    this.partitioner = null;
  }

  get zookeeperPositionNode() {
    // Generally it may be an arbitrary position object, not necessarily block number. We keep this name for backward compatibility
    return `/${this.exporter_name}/${this.topicName}/block-number`;
  }

  get zookeeperTimestampNode() {
    return `/${this.exporter_name}/${this.topicName}/timestamp`;
  }

  /**
   * @returns {Promise} Promise, resolved on connection completed.
   */
  async connect() {
    logger.info(`Connecting to zookeeper host ${ZOOKEEPER_URL}`);

    try {
      await this.zookeeperClient.connectAsync();
    }
    catch (ex) {
      console.error('Error connecting to Zookeeper: ', ex);
      throw ex;
    }

    logger.info(`Connecting to kafka host ${KAFKA_URL}`);
    const promise_result = new Promise((resolve, reject) => {
      this.producer.on('ready', resolve);
      this.producer.on('event.error', reject);
      // The user can provide a callback for delivery reports with the
      // dedicated method 'subscribeDeliveryReports'.
      this.producer.on('delivery-report', function (err) {
        if (err) {
          reject(err);
        }
      });
    });
    this.producer.connect();
    return promise_result;
  }

  /**
   * Disconnect from Zookeeper and Kafka.
   * This method is completed once the callback is invoked.
   */
  disconnect(callback?: () => void) {
    logger.info(`Disconnecting from zookeeper host ${ZOOKEEPER_URL}`);
    this.zookeeperClient.closeAsync().then(() => {
      if (this.producer.isConnected()) {
        logger.info(`Disconnecting from kafka host ${KAFKA_URL}`);
        this.producer.disconnect(callback);
      }
      else {
        logger.info(`Producer is NOT connected to kafka host ${KAFKA_URL}`);
      }
    });
  }

  async getLastPosition() {
    if (await this.zookeeperClient.existsAsync(this.zookeeperPositionNode)) {
      const previousPosition = await this.zookeeperClient.getDataAsync(
        this.zookeeperPositionNode
      );

      try {
        if (Buffer.isBuffer(previousPosition && previousPosition.data)) {
          const value = previousPosition.data.toString('utf8');

          if (value.startsWith(FORMAT_HEADER)) {
            return JSON.parse(value.replace(FORMAT_HEADER, ''));
          } else {
            return previousPosition.data;
          }
        }
      } catch (err) {
        logger.error(err);
      }
    }

    return null;
  }

  async getLastBlockTimestamp() {
    if (await this.zookeeperClient.existsAsync(this.zookeeperTimestampNode)) {
      const previousPosition = await this.zookeeperClient.getDataAsync(
        this.zookeeperTimestampNode
      );

      try {
        if (Buffer.isBuffer(previousPosition && previousPosition.data)) {
          const value = previousPosition.data.toString('utf8');

          if (value.startsWith(FORMAT_HEADER)) {
            return JSON.parse(value.replace(FORMAT_HEADER, ''));
          } else {
            return previousPosition.data;
          }
        }
      } catch (err) {
        logger.error(err);
      }
    }

    return null;
  }

  async savePosition(position: object) {
    if (typeof position !== 'undefined') {
      const newNodeValue = Buffer.from(
        FORMAT_HEADER + JSON.stringify(position),
        'utf-8'
      );

      if (await this.zookeeperClient.existsAsync(this.zookeeperPositionNode)) {
        return this.zookeeperClient.setDataAsync(
          this.zookeeperPositionNode,
          newNodeValue
        );
      } else {
        return this.zookeeperClient.mkdirpAsync(
          this.zookeeperPositionNode,
          newNodeValue
        );
      }
    }
  }

  async saveLastBlockTimestamp(blockTimestamp: number) {
    if (typeof blockTimestamp !== 'undefined') {
      const newNodeValue = Buffer.from(
        FORMAT_HEADER + JSON.stringify(blockTimestamp),
        'utf-8'
      );

      if (await this.zookeeperClient.existsAsync(this.zookeeperTimestampNode)) {
        return this.zookeeperClient.setDataAsync(
          this.zookeeperTimestampNode,
          newNodeValue
        );
      } else {
        return this.zookeeperClient.mkdirpAsync(
          this.zookeeperTimestampNode,
          newNodeValue
        );
      }
    }
  }

  async sendData(events: object | Array<object>, keyField: string | null, signalRecordData: object | null) {
    const arrayEvents: Array<object> = (events.constructor !== Array) ? [events] : events

    if (signalRecordData !== null && this.partitioner === null) {
      throw new Error('Signal record logic needs partitioner');
    }

    arrayEvents.forEach((event: any) => {
      const key = keyField !== null ? event[keyField] : null

      const partitionNumberOfPayload = this.partitioner ? this.partitioner.getPartitionNumber(event) : null;
      const eventString = typeof event === 'object' ? JSON.stringify(event) : event;
      this.producer.produce(this.topicName, partitionNumberOfPayload, Buffer.from(eventString), key);
      if (signalRecordData !== null && this.partitioner !== null) {
        const signalRecordString = typeof signalRecordData === 'object' ? JSON.stringify(signalRecordData) : signalRecordData;
        for (let partitionNumber = 0; partitionNumber < this.partitioner.getPartitionCount(); ++partitionNumber) {
          if (partitionNumber !== partitionNumberOfPayload) {
            this.producer.produce(this.topicName, partitionNumber, Buffer.from(signalRecordString), key);
          }
        }
      }
    });

    return new Promise<void>((resolve, reject) =>
      this.producer.flush(KAFKA_FLUSH_TIMEOUT, (err) => {
        if (err) return reject(err);
        resolve();
      })
    );
  }

  /**
   * Subscribe to delivery reports.
   * @param {Function} Callback to be invoked on message delivery.
   */
  async subscribeDeliveryReports(callback: () => void) {
    this.producer.on('delivery-report', callback);
  }

  /**
   * Unsubscribe from delivery reports, restoring the default error checking.
   */
  async unSubscribeDeliveryReports() {
    this.producer.on('delivery-report', function (err) {
      if (err) {
        throw err;
      }
    });
  }

  async initTransactions() {
    const promise = new Promise<void>((resolve, reject) => {
      this.producer.initTransactions(TRANSACTIONS_TIMEOUT_MS, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });

    await promise;
  }

  async storeEvents(events: object, writeSignalRecordsKafka: boolean) {
    await this.beginTransaction();
    const signalRecord: object | null = writeSignalRecordsKafka ? { 'santiment_signal_record': true } : null
    try {
      if (BLOCKCHAIN === 'utxo') {
        await this.sendData(events, 'height', signalRecord);
      } else if (BLOCKCHAIN === 'receipts') {
        await this.sendData(events, 'transactionHash', signalRecord);
      } else if (BLOCKCHAIN === 'eth') {
        await this.sendData(events, null, signalRecord);
      }
      else {
        await this.sendData(events, 'primaryKey', signalRecord);
      }
      await this.commitTransaction();
    } catch (exception) {
      logger.error('Error storing data to Kafka:' + exception);
      await this.abortTransaction();
      throw exception;
    }
  }

  async beginTransaction() {
    const promise = new Promise<void>((resolve, reject) => {
      this.producer.beginTransaction((err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });

    await promise;
  }

  async commitTransaction() {
    const promise = new Promise<void>((resolve, reject) => {
      this.producer.commitTransaction(TRANSACTIONS_TIMEOUT_MS, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });

    await promise;
  }

  async abortTransaction() {
    const promise = new Promise<void>((resolve, reject) => {
      this.producer.abortTransaction(TRANSACTIONS_TIMEOUT_MS, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });

    await promise;
  }

  async initPartitioner(hashFunction: ((value: object) => number)) {
    // We delay the finding of the partition count so that we are sure that we have a connected producer
    this.partitioner = new Partitioner();
    await this.partitioner.init(hashFunction, this.topicName, this.producer);
  }

  isConnected(): boolean {
    return this.producer.isConnected();
  }
}

