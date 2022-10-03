const DRY_RUN = parseInt(process.env.DRY_RUN || '1');
const BLOCK_INTERVAL = parseInt(process.env.BLOCK_INTERVAL || '50');
const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || '3');
const START_BLOCK = parseInt(process.env.START_BLOCK || '0');
const GET_RECEIPTS_ENDPOINT = process.env.GET_RECEIPTS_ENDPOINT || 'eth_getBlockReceipts';
const NODE_URL = process.env.NODE_URL || 'http://localhost:8545/';
const TRANSACTION = parseInt(process.env.TRANSACTION || '0');
const GET_BLOCK_ENDPOINT = process.env.GET_BLOCK_ENDPOINT || 'eth_getBlockByNumber';

module.exports = {
  DRY_RUN,
  BLOCK_INTERVAL,
  CONFIRMATIONS,
  START_BLOCK,
  GET_RECEIPTS_ENDPOINT,
  NODE_URL,
  TRANSACTION,
  GET_BLOCK_ENDPOINT
};
