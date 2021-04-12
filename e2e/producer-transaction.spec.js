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
const {work} = require('../lib/work')
const KAFKA_URL = process.env.KAFKA_URL || "localhost:9092";
const sinon = require("sinon");
const assert = require("assert")
const metrics = require('san-exporter/metrics');

async function create_consumer(topic, num_expected) {
  var num_received = 0;
  var result = [];

  num_received = 0;
  var consumer = new Kafka.KafkaConsumer({
    'metadata.broker.list': KAFKA_URL,
    'group.id': 'node-rdkafka-consumer-flow-example',
    'enable.auto.commit': true,
    'isolation.level': 'read_committed'
  });

  consumer.connect();
  return new Promise((resolve, reject) => {
    consumer.on('ready', function(arg) {
      consumer.subscribe([topic]);
      console.log("Subscribing to topic", topic);

      //start consuming messages
      consumer.consume();
      resolve(consumer);
    });
    consumer.on('event.error', function(err) {
      console.error('Error from consumer');
      console.error(err);
    });
    consumer.on('data', function(m) {
      counter++;
      result.push(m);

      console.log("Read message number ", counter);
      consumer.commit(m);
      if (num_received == num_expected) {
        resolve(result);
      }
    });
  });
}


describe('Producer transactions', function() {
  var exporter;

  describe('Transactional messages should be delivered', function() {
    beforeEach(async function() {
      exporter = new Exporter('erc20-producer-transactions-test', true)
      await exporter.connect();
      exporter.initTransactions();
    });

    afterEach(async function() {
      await exporter.disconnect();
      exporter = null;
    });

    /*it('should get 100% deliverability if transaction is commited', async function() {
      num_messages_test = 10;
      this.timeout(5000);

      exporter.beginTransaction();
      var consumer_promise = create_consumer(exporter.topic_name);

      for (i = 0; i <= num_messages_test; i++) {
        await exporter.sendDataWithKey({
          timestamp: 10000000,
          iso_date: new Date().toISOString(),
          key: 1
      }, "key")
      }

      exporter.commitTransaction();

      console.log("Waiting to read ",num_messages_test, "messages");
      await consumer_promise;
    });*/

    it("using the 'work' function should begin and commit a transaction", async function() {
      num_messages_test = 10;
      this.timeout(3000);

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

      function mockGetEventsFunction() {
        return [testEvent];
      }
      const dummyLastBlockNumber = 1000000;

      const sandbox = sinon.createSandbox();
      // This would mock all the methods of the metrics object
      sandbox.spy(metrics);

      const dummyLastProcessedPosition = {
        blockNumber: 1,
        primaryKey: 1
      }

      var consumer_promise = create_consumer(exporter.topic_name);

      for (i = 0; i <= num_messages_test; i++) {
        await work(exporter,
                   dummyLastBlockNumber,
                   mockGetEventsFunction,
                   metrics,
                   dummyLastProcessedPosition);
      }

      console.log("Waiting to read ",num_messages_test, "messages");
      await consumer_promise;

      assert.strictEqual(dummyMonitor.called ,true);
    });
  });
});
