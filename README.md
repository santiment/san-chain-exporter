# san-chain-exporter

An exporter that exports transfers from multiple blockchains to a Kafka topic.

## Runtime

The Docker image is pinned to Node.js 21.4.0 in `docker/Dockerfile`, and the repository pins the same version in `.tool-versions`.

## Local Setup With asdf

If you use `asdf`, the checked-in `.tool-versions` file already points to Node.js `21.4.0`.

1. Install the `nodejs` plugin once on your machine:

```bash
asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git
```

2. Install the version required by this repository:

```bash
asdf install
asdf current nodejs
```

3. Install dependencies:

```bash
npm ci
```

Useful `asdf` commands:

```bash
# Show the version selected for this directory
asdf current nodejs

# Temporarily force a specific version in the current shell
asdf shell nodejs 21.4.0

# Rewrite .tool-versions in the current directory
asdf local nodejs 21.4.0
```

`node-rdkafka` is a native module. If you switch Node.js versions after installing dependencies, rerun `npm ci` (or at least rebuild that module) so native bindings match the active Node.js version.

## Run

You can export from any of the blockchains by starting one of the scripts in the `bin` directory. See `bin/README.md` for Docker-based workflows.

For local development:

```bash
npm ci
npm run build
npm start
```

### Health checks

You can make health check GET requests to the service. The health check makes a request to Kafka to make sure the
connection is not lost, try to request current block number of the blockchain and also checks time from the previous
pushing data to kafka (or time of the service start if no data pushed yet):

```bash
curl http://localhost:3000/healthcheck
```

If the health check passes you get response code 200 and response message `ok`.
If the health check does not pass you get response code 500 and a message describing what failed.

Prometheus metrics are exposed on:

```bash
curl http://localhost:3000/metrics
```

## Log level

You can control the log level during development with the following environment variables:

* `LOG_LEVEL`. Severity of messages that will be produced. Available values are "trace", "debug", "info", "warn", "error", "fatal"
* `RDKAFKA_DEBUG`. This determines which rdkafka debug contexts will be enabled. The value corresponds to the `debug` configuration value of rdkafka. See https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md for possible values. By default no contexts are enabled.


## Unit Tests

You can run the unit tests in one of the following ways:

1) Without Docker
Use Node.js `21.4.0` locally to match the Docker image and `.tool-versions`.
```bash
$ npm ci
$ npm test
```

2) With Docker
```bash
$ ./bin/test.sh
```
## Integration tests

Those are tests which would run the exporter against a running Node and compare the output to expected values.

```
npm run integration_test
```

## Writing exporters

When writing data exporter you need to make sure the following things:

* All the logging should be on the stdout. Do not create any temp files, as they
will most probably disappear in an event of a restart
* All the config should come from ENV variables
* An exporter should continue from where it was interrupted in case of a restart.
You can save the current position using the `savePosition(position)` API.
* Encode the data as JSON

## Exporter API

The main `Exporter` API used by workers and tests currently includes:

* `connect` - establish connection to the dependent services. Returns a Promise.
* `disconnect` - close Zookeeper and Kafka connections. Supports both `await exporter.disconnect()` and legacy callback style `exporter.disconnect(callback)`.
* `initTransactions` - initialize Kafka transactions. Returns a Promise.
* `getLastPosition` - fetch the last saved position. Returns a Promise.
* `getLastBlockTimestamp` - fetch the last saved block timestamp. Returns a Promise.
* `savePosition` - update the last saved exporter position. Returns a Promise.
* `saveLastBlockTimestamp` - update the last saved block timestamp. Returns a Promise.
* `sendData` - push a single event or an array of events. Returns a Promise.
* `storeEvents` - write events inside a Kafka transaction. Returns a Promise.
* `subscribeDeliveryReports` / `unSubscribeDeliveryReports` - manage Kafka delivery report listeners.
