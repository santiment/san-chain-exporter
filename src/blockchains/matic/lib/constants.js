const RPC_USERNAME = process.env.RPC_USERNAME;
const RPC_PASSWORD = process.env.RPC_PASSWORD;
const BLOCK_INTERVAL = parseInt(process.env.BLOCK_INTERVAL || '100');
const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || '15');
const NODE_URL = process.env.NODE_URL || process.env.PARITY_URL || 'http://localhost:8545/';
const LOOP_INTERVAL_CURRENT_MODE_SEC = parseInt(process.env.LOOP_INTERVAL_CURRENT_MODE_SEC || '30');

module.exports = {
  RPC_USERNAME,
  RPC_PASSWORD,
  BLOCK_INTERVAL,
  CONFIRMATIONS,
  NODE_URL,
  LOOP_INTERVAL_CURRENT_MODE_SEC
};
