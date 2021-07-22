# San-node-exporter

An exporter that exports transfers from multiple blockchains to a Kafka topic.

## Run

You can export from any of the blockchains by starting any of the scripts inside the bin directory.

### Health checks

You can make health check GET requests to the service. The health check makes a request to Kafka to make sure the
connection is not lost, try to request current block number of the blockchain and also checks time from the previous
pushing data to kafka (or time of the service start if no data pushed yet):

```bash
curl http://localhost:3000/healthcheck
```

If the health check passes you get response code 200 and response message `ok`.
If the health check does not pass you get response code 500 and a message describing what failed.

## Tests

You can run the unit tests with:

```bash
$ ./bin/test.sh

You can run the integration tests with:
$ ./e2e/test.sh

## Writing exporters

When writing data exporter you need to make sure the following things:

* All the logging should be on the stdout. Do not create any temp files, as they
will most probably disappear in an event of a restart
* All the config should come from ENV variables
* An exporter should continue from where it was interrupted in case of a restart.
You can save the current position using the `savePosition(position)` API.
* Encode the data as JSON

## API

* `connect` - establish connection to the dependent services. Returns a Promise
* `getLastPosition` - fetch the last saved position. Returns a Promise
* `savePosition` - update the last position of the exporter. Returns a Promise
* `sendData` - push an array of events. Returns a Promise
