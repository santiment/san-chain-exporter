import { getIntEnvVariable } from '../../../lib/utils.js';

export const NODE_URL = process.env.NODE_URL;
export const MAX_RETRIES = getIntEnvVariable('MAX_RETRIES', 3);
export const CONFIRMATIONS = getIntEnvVariable('CONFIRMATIONS', 3);
export const DEFAULT_TIMEOUT = getIntEnvVariable('DEFAULT_TIMEOUT', 10000);
export const MAX_CONCURRENT_REQUESTS = getIntEnvVariable('MAX_CONCURRENT_REQUESTS', 10);
export const EXPORT_TIMEOUT_MLS = getIntEnvVariable('EXPORT_TIMEOUT_MLS', 1000 * 60 * 15); // 15 minutes
export const LOOP_INTERVAL_CURRENT_MODE_SEC = getIntEnvVariable('LOOP_INTERVAL_CURRENT_MODE_SEC', 30);

