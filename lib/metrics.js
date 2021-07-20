const {Counter, Gauge, Summary} = require('prom-client')
const { logger } = require('./logger')

module.exports.restartCounter = new Counter({
    name: 'restart_count',
    help: 'Number of restarts'
});

module.exports.downloadedTransactionsCounter = new Counter({
    name: 'downloaded_transactions_count',
    help: 'Number of transactions downloaded'
});

module.exports.downloadedBlocksCounter = new Counter({
    name: 'downloaded_blocks_count',
    help: 'Number of blocks downloaded'
});

module.exports.requestsCounter = new Counter({
    name: 'requests_made_count',
    help: 'Number of requests made to the node',
    labelNames: ['connection']
});

module.exports.requestsResponseTime = new Summary({
    name: 'requests_response_time',
    help: 'The response time of the requests to the node',
    labelNames: ['connection']
});

module.exports.requestsQueueSize = new Gauge({
    name: 'requests_queue_size',
    help: 'Number of requests that are in the queue',
    labelNames: ['connection']
});

module.exports.lastExportedBlock = new Gauge({
    name: 'last_exported_block',
    help: 'The last block that was saved by the exporter'
});

module.exports.currentBlock = new Gauge({
    name: 'current_block',
    help: 'The latest blocks on the blockchain'
});

module.exports.startCollection = function () {
    logger.info(`Starting the collection of metrics, the metrics are available on /metrics`);
    require('prom-client').collectDefaultMetrics();
};

module.exports.register = require('prom-client').register
