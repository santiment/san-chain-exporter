export const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || '3');
export const LOOP_INTERVAL_CURRENT_MODE_SEC = parseInt(process.env.LOOP_INTERVAL_CURRENT_MODE_SEC || '30');
export const NODE_REQUEST_RETRY = parseInt(process.env.NODE_REQUEST_RETRY || '5');
export const BLOCK_INTERVAL = parseInt(process.env.BLOCK_INTERVAL || '1000');
export const CARDANO_GRAPHQL_URL = process.env.CARDANO_GRAPHQL_URL || 'http://localhost:3100/graphql';
export const DEFAULT_TIMEOUT_MSEC = parseInt(process.env.DEFAULT_TIMEOUT || '30000');
