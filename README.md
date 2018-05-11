# ERC20 Transfer Event Exporter

A small service that exports all ERC20 Transfer Events from the ethereum blockchain to a Kafka topic. It is written in javascript and uses ![web3.js](https://github.com/ethereum/web3.js/) library which implements the Ethereum JSON RPC spec.

## Setup

To setup the service install all node packages:

```bash
$ npm install
```

Also make sure you have access to a parity JSON-RPC node to hook it to.

## Running the service

The service assumes by default that you have a parity JSON-RPC service running on `http://localhost:8545` and that you have a local kafka deployment running on `localhost:9092`. If this is not the case you can specify the URL to the parity service using the `PARITY_URL` env variable and the URL to the kafka service with the env var `KAFKA_HOST`.

Example:

```bash
$ npm start
```

This will start the service on local port 3000.

If you want to specify a custom parity and kafka services:

```bash
$ PARITY_URL=<parity_url> KAFKA_HOST=<kafka_host> npm start
```

You can make health check GET requests to the service. The health check makes a request to Kafka and Parity to make sure the connection is not lost:

```bash
curl http://localhost:3000/healthcheck
```

If the health check passes you get response code 200 and response message `ok`.
If the health check does not pass you get response code 500 and a message describing what failed.

## Running the tests

You can run the tests with:

```bash
$ npm run test
```
