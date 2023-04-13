const BLOCK_INTERVAL = parseInt(process.env.BLOCK_INTERVAL || '100');
const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || '3');
const NODE_URL = process.env.NODE_URL || process.env.PARITY_URL || 'http://localhost:8545/';
const LOOP_INTERVAL_CURRENT_MODE_SEC = parseInt(process.env.LOOP_INTERVAL_CURRENT_MODE_SEC || '30');
const BURN_ADDRESS = 'burn';
const ETH_WITHDRAWAL = 'withdrawal'
const IS_ETH = parseInt(process.env.IS_ETH || '1');
const LONDON_FORK_BLOCK = 12965000;
const SHANGHAI_FORK_BLOCK = 17034871;
// This is the API method that Parity provides for fetching receipts across multiple blocks. Erigon instead provides
// a method called 'eth_getBlockReceipts'. If we are deploying against Erigon, we need to overwrite this variable
// through the deploy.
const RECEIPTS_API_METHOD = process.env.RECEIPTS_API_METHOD || 'eth_getBlockReceipts';

module.exports = {
    BLOCK_INTERVAL,
    CONFIRMATIONS,
    NODE_URL,
    LOOP_INTERVAL_CURRENT_MODE_SEC,
    BURN_ADDRESS,
    IS_ETH,
    LONDON_FORK_BLOCK,
    SHANGHAI_FORK_BLOCK,
    RECEIPTS_API_METHOD
};
