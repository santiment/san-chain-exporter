const { Counter, Gauge, Summary } = require('prom-client')

module.exports.currentLedger = new Gauge({
    name: 'current_ledger',
    help: 'The current ledger being uploaded'
});

module.exports.requestsCounter = new Counter({
    name: 'requests_made_count',
    help: 'Number of requests made to the node',
});

module.exports.requestsResponseTime = new Summary({
    name: 'requests_response_time',
    help: 'The response time of the requests to the node',
});

module.exports.startCollection = function () {
    console.info(`Starting the collection of metrics, the metrics are available on /metrics`);
    require('prom-client').collectDefaultMetrics();
};

module.exports.register = require('prom-client').register
