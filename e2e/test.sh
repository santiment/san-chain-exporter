#! /bin/sh

KAFKA_URL=localhost:9092 ZOOKEEPER_URL=localhost:2181 KAFKA_TOPIC=erc20_exporter_test ./node_modules/.bin/mocha ./built/e2e/producer-transaction.spec.js
