import { getIntEnvVariable } from '../../../lib/utils';

export const CONFIRMATIONS = getIntEnvVariable('CONFIRMATIONS', 3);
export const BLOCK_INTERVAL = getIntEnvVariable('BLOCK_INTERVAL', 100);
export const NODE_URL = process.env.NODE_URL || 'http://localhost:8545/';
export const LOOP_INTERVAL_CURRENT_MODE_SEC = getIntEnvVariable('LOOP_INTERVAL_CURRENT_MODE_SEC', 30);


