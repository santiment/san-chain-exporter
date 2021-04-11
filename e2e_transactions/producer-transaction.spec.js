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
const work = require('../lib/work_loop')
var t = require('assert');
const KAFKA_URL = process.env.KAFKA_URL || "localhost:9092";

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


describe('Producer', function() {
  var exporter;

  describe('Transactional messages should be delivered', function() {
    beforeEach(async function() {
      exporter = new Exporter('erc20-producer-transactions-test', true)
      await exporter.connect();
    });

    afterEach(function() {
      exporter.disconnect();
    });

    it('should get 100% deliverability if transaction is commited', async function() {
      num_messages_test = 10;
      this.timeout(30000);

      exporter.initTransactions();
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
    });
  });
});
