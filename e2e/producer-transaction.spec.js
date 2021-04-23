/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

const { Exporter } = require('san-exporter')
const Kafka = require("@santiment-network/node-rdkafka")
const {storeEvents} = require('../lib/store_events')
const KAFKA_URL = process.env.KAFKA_URL || "localhost:9092";

class TestConsumer {
  constructor(topic, num_expected) {
    this.num_received = 0;
    this.result = [];

    this.consumer = new Kafka.KafkaConsumer({
      'metadata.broker.list': KAFKA_URL,
      'group.id': 'node-rdkafka-consumer-flow-example',
      'debug': 'all',
      'topic.metadata.refresh.interval.ms': 500,
      'enable.auto.commit': true,
      'isolation.level': 'read_committed'
    });

    // Copying the member variables so that they are seen in the closures
    var consumer = this.consumer;
    var result = this.result;
    var num_received = this.num_received;

    this.consumer.setDefaultConsumeTimeout(10000);

    this.dataReadPromise = new Promise((resolve, reject) => {
      consumer.on('data', function(m) {
        num_received++;
        result.push(m);

        if (num_received == num_expected) {
          resolve(result);
        }
      });
    });

    this.subscribedPromise = new Promise((resolve, reject) => {
      consumer.on('event.error', function(err) {
        console.error('Error from consumer');
        console.error(err);
        reject(err);
      });
      consumer.on('ready', function () {
        consumer.subscribe([topic]);
      }, 2000);
      consumer.on('subscribed', function() {
        consumer.consume();
        resolve();
      })
      consumer.on('warning', function (err) {
        console.log("Warning: ", err);
      });;
    });

    this.consumer.connect();
  }

  async waitSubscribed() {
    await this.subscribedPromise;
  }

  async waitData() {
    await this.dataReadPromise;
  }
}


describe('Producer transactions', function() {
  var exporter;

  // This is done only to create the test topic.
  before( function(done) {
    this.timeout(5000);
    exporter = new Exporter('erc20-producer-transactions-test', true)
    exporter.connect().then(function () {
      exporter.subscribeDeliveryReports(function (err, report) {
        if(err) {
          throw err;
        }
        exporter.disconnect(function () {
          done()
        })
      })

      exporter.initTransactions();
      exporter.beginTransaction();

      // At this point the exporter is connected.
      // We send one message just to create the topic.
      exporter.sendDataWithKey({
        timestamp: 10000000,
        iso_date: new Date().toISOString(),
        key: 1
      }, "key")

      exporter.commitTransaction();
    });
  })

  beforeEach(function(done) {
    this.timeout(5000);

    exporter = new Exporter('erc20-producer-transactions-test', true)
    exporter.connect().then(() => done());
  });

  afterEach(function(done) {
    exporter.disconnect(done);
  });

  it('should get 100% deliverability if transaction is commited', async function() {
    var num_messages_test = 10;
    this.timeout(5000);

    var testConsumer = new TestConsumer(exporter.topic_name, num_messages_test);
    await testConsumer.waitSubscribed();

    exporter.initTransactions();
    exporter.beginTransaction();

    // Do a small delay before starting writing messages, otherwise the consumer is missing them.
    // This should not really be needed, because we have received the 'subscribed' event in the
    // consumer but there is something I am missing.
    setTimeout( function () {
      for (i = 0; i < num_messages_test; i++) {
        exporter.sendDataWithKey({
          timestamp: 10000000,
          iso_date: new Date().toISOString(),
          key: 1
        }, "key")
      }
      exporter.commitTransaction();
    }, 2000)

    await testConsumer.waitData();
  });

  it("using the 'storeEvents' function should begin and commit a transaction", async function() {
    num_messages_test = 10;
    this.timeout(5000);
    exporter.initTransactions();

    const testEvent = {
      "contract": "0xdac17f958d2ee523a2206206994597c13d831ec7",
      "blockNumber": 10449812,
      "timestamp": 0,
      "transactionHash": "0x0bdd08bd9af129373d2b8011775d3d8b0588e30f45b0f3c1b7d85d689d05c42b",
      "logIndex": 122,
      "to": "0xd49e06c1ed4925af893a503bfcb9cff947e7679e",
      "from": "0x5a5d5d0cde67e18f00e5d08ad7890858a6ee62bc",
      "value": 103000000,
      "valueExactBase36": "1pbnb4"
    }

    var testConsumer = new TestConsumer(exporter.topic_name, num_messages_test);
    await testConsumer.waitSubscribed();

    setTimeout(function () {
      for (i = 0; i <= num_messages_test; i++) {
        storeEvents(exporter, [testEvent]);
      }
    }, 2000);

    await testConsumer.waitData();
  });
});
