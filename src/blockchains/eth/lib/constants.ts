import { getLazyBoolEnvVariable, getIntEnvVariable } from '../../../lib/utils.js';

const BURN_ADDRESS = 'burn';
const ETH_WITHDRAWAL = 'withdrawal';
const LONDON_FORK_BLOCK = 12965000;
const SHANGHAI_FORK_BLOCK = 17034871;
const IS_ETH = getLazyBoolEnvVariable('IS_ETH');
const CONFIRMATIONS = getIntEnvVariable('CONFIRMATIONS', 3);
const BLOCK_INTERVAL = getIntEnvVariable('BLOCK_INTERVAL', 100);
const RECEIPTS_API_METHOD = process.env.RECEIPTS_API_METHOD || 'eth_getBlockReceipts';
const NODE_URL = process.env.NODE_URL || 'http://localhost:8545/';
const LOOP_INTERVAL_CURRENT_MODE_SEC = getIntEnvVariable('LOOP_INTERVAL_CURRENT_MODE_SEC', 30);

export {
    BLOCK_INTERVAL,
    CONFIRMATIONS,
    NODE_URL,
    LOOP_INTERVAL_CURRENT_MODE_SEC,
    BURN_ADDRESS,
    ETH_WITHDRAWAL,
    IS_ETH,
    LONDON_FORK_BLOCK,
    SHANGHAI_FORK_BLOCK,
    RECEIPTS_API_METHOD
};

