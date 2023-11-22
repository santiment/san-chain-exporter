const Kafka = require('node-rdkafka');
const { BLOCKCHAIN } = require('./constants');
const ZookeeperClientAsync = require('./zookeeper_client_async');
const { logger, SYSLOG_LOG_LEVEL, log_according_to_syslog_level } = require('./logger');

const ZOOKEEPER_URL = process.env.ZOOKEEPER_URL || 'localhost:2181';
const ZOOKEEPER_RETRIES = parseInt(process.env.ZOOKEEPER_RETRIES || '0');
const ZOOKEEPER_SPIN_DELAY = parseInt(process.env.ZOOKEEPER_SPIN_DELAY || '1000');
const ZOOKEEPER_SESSION_TIMEOUT = parseInt(process.env.ZOOKEEPER_SESSION_TIMEOUT || '30000');

const FORMAT_HEADER = 'format=json;';
const RDKAFKA_DEBUG = process.env.RDKAFKA_DEBUG || null;
const KAFKA_URL = process.env.KAFKA_URL || 'localhost:9092';
const KAFKA_COMPRESSION_CODEC = process.env.KAFKA_COMPRESSION_CODEC || 'lz4';
const KAFKA_FLUSH_TIMEOUT = parseInt(process.env.KAFKA_FLUSH_TIMEOUT || '10000');
const BUFFERING_MAX_MESSAGES = parseInt(process.env.BUFFERING_MAX_MESSAGES || '150000');
const TRANSACTIONS_TIMEOUT_MS = parseInt(process.env.TRANSACTIONS_TIMEOUT_MS || '60000');
const KAFKA_MESSAGE_MAX_BYTES = parseInt(process.env.KAFKA_MESSAGE_MAX_BYTES || '10485760');

process.on('unhandledRejection', (reason, p) => {
  // Otherwise unhandled promises are not possible to trace with the information logged
  logger.error(
    'Unhandled Rejection at: ',
    p,
    'reason:',
    reason,
    'error stack:',
    reason.stack
  );
  process.exit(1);
});

class Partitioner {
  constructor() {
    this.hashFunction = null;
  }

  async init(hashFunction, topicName, producer) {
    if (hashFunction) {
      this.hashFunction = hashFunction;
      this.partitionCount = await this.findPartitionCount(topicName, producer);
      if (this.partitionCount <= 0) {
        throw new Error('Partition count should be > 0');
      }
    }
  }

  // We depend on the producer already being connected
  async findPartitionCount(topicName, producer) {
    logger.info(`Finding partition count for topic ${topicName}`);
    const metadata = await new Promise((resolve, reject) => {
      producer.getMetadata({ topic: topicName, timeout: 10000 }, (err, metadata) => {
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

  getPartitionNumber(event) {
    if (!this.hashFunction) {
      // Should be left to 'null' if we want library to choose partition for us
      return null;
    }

    return this.hashFunction(event) % this.partitionCount;
  }
}

class Exporter {
  constructor(exporter_name, transactional = false) {
    this.exporter_name = exporter_name;
    var producer_settings = {
      'metadata.broker.list': KAFKA_URL,
      'client.id': this.exporter_name,
      'compression.codec': KAFKA_COMPRESSION_CODEC,
      'queue.buffering.max.messages': BUFFERING_MAX_MESSAGES,
      'message.max.bytes': KAFKA_MESSAGE_MAX_BYTES,
      'dr_cb': true,
      'log_level': SYSLOG_LOG_LEVEL
    };

    if (RDKAFKA_DEBUG) {
      producer_settings['debug'] = RDKAFKA_DEBUG;
    }

    if (transactional) {
      producer_settings['transactional.id'] = this.topicName;
      producer_settings['enable.idempotence'] = true;
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

    this.topicName = process.env.KAFKA_TOPIC || this.exporter_name.replace('-exporter', '').replace('-', '_');
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
    var promise_result = new Promise((resolve, reject) => {
      this.producer.on('ready', resolve);
      this.producer.on('event.error', reject);
      // The user can provide a callback for delivery reports with the
      // dedicated method 'subscribeDeliveryReports'.
      this.producer.on('delivery-report', function (err) {
        if (err) {
          throw err;
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
  disconnect(callback) {
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

  async savePosition(position) {
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

  async saveLastBlockTimestamp(blockTimestamp) {
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

  async sendData(events) {
    if (events.constructor !== Array) {
      events = [events];
    }

    events = events.map(
      event => (typeof event === 'object' ? JSON.stringify(event) : event)
    );
    events.forEach(event => {
      this.producer.produce(this.topicName, null, Buffer.from(event));
    });

    return new Promise((resolve, reject) =>
      this.producer.flush(KAFKA_FLUSH_TIMEOUT, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      })
    );
  }

  async sendDataWithKey(events, keyField) {
    logger.debug(`Sending ${events.length} messages to Kafka`);

    if (events.constructor !== Array) {
      events = [events];
    }

    let totalMessageSize = 0;
    const startTime = new Date();
    events.forEach(event => {
      const partitionNumber = this.partitioner.getPartitionNumber(event);
      const eventString = typeof event === 'object' ? JSON.stringify(event) : event;
      this.producer.produce(this.topicName, partitionNumber, Buffer.from(eventString), event[keyField]);
      totalMessageSize += eventString.length;
    });

    return new Promise((resolve, reject) => {
      this.producer.flush(KAFKA_FLUSH_TIMEOUT, (err, result) => {
        if (err) {
          return reject(err);
        }
        const endTime = new Date();
        logger.debug(`Sending ${events.length} messages with total size of ${Math.round(totalMessageSize / 1024)} KBs took ${endTime - startTime} milliseconds`);
        resolve(result);
      });
    }
    );
  }

  /**
   * Subscribe to delivery reports.
   * @param {Function} Callback to be invoked on message delivery.
   */
  async subscribeDeliveryReports(callback) {
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
    const promise = new Promise((resolve, reject) => {
      this.producer.initTransactions(TRANSACTIONS_TIMEOUT_MS, (err) => {
        if (err) {
          return reject(err);
        }

        resolve();
      });
    });

    await promise;
  }

  async storeEvents(events) {
    await this.beginTransaction();
    try {
      if (BLOCKCHAIN === 'utxo') {
        await this.sendDataWithKey(events, 'height');
      } else if (BLOCKCHAIN === 'receipts') {
        await this.sendDataWithKey(events, 'transactionHash');
      } else {
        await this.sendDataWithKey(events, 'primaryKey');
      }
      await this.commitTransaction();
    } catch (exception) {
      logger.error('Error storing data to Kafka:' + exception);
      this.abortTransaction();
      throw exception;
    }
  }

  async beginTransaction() {
    const promise = new Promise((resolve, reject) => {
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
    const promise = new Promise((resolve, reject) => {
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
    const promise = new Promise((resolve, reject) => {
      this.producer.abortTransaction(TRANSACTIONS_TIMEOUT_MS, (err) => {
        if (err) {
          return reject(err);
        }

        resolve();
      });
    });

    await promise;
  }

  async initPartitioner(hashFunction) {
    // We delay the finding of the partition count so that we are sure that we have a connected producer
    this.partitioner = new Partitioner();
    await this.partitioner.init(hashFunction, this.topicName, this.producer);
  }
}

module.exports = {
  Exporter
};
