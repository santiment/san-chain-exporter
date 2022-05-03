const MAX_CONNECTION_CONCURRENCY = parseInt(process.env.MAX_CONNECTION_CONCURRENCY || "5")
const TIMEOUT_BETWEEN_REQUESTS_BURST_MSEC = parseInt(process.env.TIMEOUT_BETWEEN_REQUESTS_BURST_MSEC || "2000")
const BNB_CHAIN_START_MSEC = parseInt(process.env.BNB_CHAIN_START_MSEC || "1555545600000")
const LOOP_INTERVAL_CURRENT_MODE_SEC = parseInt(process.env.LOOP_INTERVAL_CURRENT_MODE_SEC || "30")
// Stay number of msecs behind the chain head in case of forks
const SAFETY_BLOCK_WAIT_MSEC = 100000;
// We start by fetching transactions for an hour. This will be dynamically reduced when the transactions number increase.
const FETCH_INTERVAL_HISTORIC_MODE_MSEC =  parseInt(process.env.FETCH_INTERVAL_HISTORIC_MODE_MSEC || "3600000")
// The biggest page we can ask the BNB API for. We should query a time interval small enough, so that it results fit in this number of pages.
const BNB_API_MAX_PAGE = parseInt(process.env.BNB_API_MAX_PAGE || "100")
// The maximum number of rows that can be requested according to the BNB API. The value is different depending on the request.
const MAX_NUM_ROWS_TIME_INTERVAL = 100

module.exports = {
    MAX_CONNECTION_CONCURRENCY,
    TIMEOUT_BETWEEN_REQUESTS_BURST_MSEC,
    BNB_CHAIN_START_MSEC,
    LOOP_INTERVAL_CURRENT_MODE_SEC,
    SAFETY_BLOCK_WAIT_MSEC,
    FETCH_INTERVAL_HISTORIC_MODE_MSEC,
    BNB_API_MAX_PAGE,
    MAX_NUM_ROWS_TIME_INTERVAL
}