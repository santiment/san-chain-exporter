export const DRY_RUN = parseInt(process.env.DRY_RUN || '1');
export const BLOCK_INTERVAL = parseInt(process.env.BLOCK_INTERVAL || '50');
export const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || '3');
export const START_BLOCK = parseInt(process.env.START_BLOCK || '0');
export const GET_RECEIPTS_ENDPOINT = process.env.GET_RECEIPTS_ENDPOINT || 'eth_getBlockReceipts';
export const NODE_URL = process.env.NODE_URL || 'http://localhost:8545/';
export const TRANSACTION = parseInt(process.env.TRANSACTION || '0');
export const GET_BLOCK_ENDPOINT = process.env.GET_BLOCK_ENDPOINT || 'eth_getBlockByNumber';
export const LOOP_INTERVAL_CURRENT_MODE_SEC = parseInt(process.env.LOOP_INTERVAL_CURRENT_MODE_SEC || '30');

