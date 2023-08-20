const MAX_CONCURRENT_REQUESTS = parseInt(process.env.MAX_CONCURRENT_REQUESTS || '10');
const DEFAULT_TIMEOUT = parseInt(process.env.DEFAULT_TIMEOUT || '10000');
const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || '3');
const NODE_URL = process.env.NODE_URL || 'http://litecoin.stage.san:30992';
const RPC_USERNAME = process.env.RPC_USERNAME || 'rpcuser';
const RPC_PASSWORD = process.env.RPC_PASSWORD || 'rpcpassword';
const EXPORT_TIMEOUT_MLS = parseInt(process.env.EXPORT_TIMEOUT_MLS || 1000 * 60 * 15); // 15 minutes
const LOOP_INTERVAL_CURRENT_MODE_SEC = parseInt(process.env.LOOP_INTERVAL_CURRENT_MODE_SEC || '30');
const DOGE = process.env.DOGE || 0;

module.exports = {
  MAX_CONCURRENT_REQUESTS,
  DEFAULT_TIMEOUT,
  CONFIRMATIONS,
  RPC_USERNAME,
  RPC_PASSWORD,
  NODE_URL,
  EXPORT_TIMEOUT_MLS,
  DOGE,
  LOOP_INTERVAL_CURRENT_MODE_SEC
};
