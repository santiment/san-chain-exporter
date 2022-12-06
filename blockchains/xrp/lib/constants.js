// Although we request the last 'validated' block we are seeing blocks which are neither validated nor even closed.
// We introduce this extra delay to prevent this.
// In terms of time, 20 blocks is a delay between 1 and 2 minutes.
const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || '20');
const SEND_BATCH_SIZE = parseInt(process.env.SEND_BATCH_SIZE || '30');
const DEFAULT_WS_TIMEOUT = parseInt(process.env.DEFAULT_WS_TIMEOUT || '10000');
const CONNECTIONS_COUNT = parseInt(process.env.CONNECTIONS_COUNT || '1');
const MAX_CONNECTION_CONCURRENCY = parseInt(process.env.MAX_CONNECTION_CONCURRENCY || '10');
const XRP_NODE_URLS = process.env.XRP_NODE_URLS || 'wss://s2.ripple.com';
const EXPORT_TIMEOUT_MLS = parseInt(process.env.EXPORT_TIMEOUT_MLS || 1000 * 60 * 5);
const LOOP_INTERVAL_CURRENT_MODE_SEC = 1000;

module.exports = {
  SEND_BATCH_SIZE,
  DEFAULT_WS_TIMEOUT,
  CONNECTIONS_COUNT,
  MAX_CONNECTION_CONCURRENCY,
  XRP_NODE_URLS,
  EXPORT_TIMEOUT_MLS,
  CONFIRMATIONS,
  LOOP_INTERVAL_CURRENT_MODE_SEC
};
