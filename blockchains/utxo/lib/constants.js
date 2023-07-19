const RPC_USERNAME = process.env.RPC_USERNAME || 'rpcuser';
const RPC_PASSWORD = process.env.RPC_PASSWORD || 'rpcpassword';
const NODE_URL = process.env.NODE_URL;

const DOGE = process.env.DOGE || 0;
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3;
const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS) || 3;
const DEFAULT_TIMEOUT = parseInt(process.env.DEFAULT_TIMEOUT) || 10000;
const MAX_CONCURRENT_REQUESTS = parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 10;
const EXPORT_TIMEOUT_MLS = parseInt(process.env.EXPORT_TIMEOUT_MLS) || 1000 * 60 * 15; // 15 minutes
const LOOP_INTERVAL_CURRENT_MODE_SEC = parseInt(process.env.LOOP_INTERVAL_CURRENT_MODE_SEC) || 30;

module.exports = {
  DOGE,
  NODE_URL,
  MAX_RETRIES,
  RPC_USERNAME,
  RPC_PASSWORD,
  CONFIRMATIONS,
  DEFAULT_TIMEOUT,
  EXPORT_TIMEOUT_MLS,
  MAX_CONCURRENT_REQUESTS,
  LOOP_INTERVAL_CURRENT_MODE_SEC
};
