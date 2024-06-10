import { getBoolEnvVariable, getIntEnvVariable } from "./utils"


export const BLOCKCHAIN = process.env.BLOCKCHAIN;
export const CONFIG_PATH = process.env.CONFIG_PATH;
export const RPC_USERNAME = process.env.RPC_USERNAME || 'rpcuser';
export const RPC_PASSWORD = process.env.RPC_PASSWORD || 'rpcpassword';
export const EXPORT_BLOCKS_LIST = process.env.EXPORT_BLOCKS_LIST || false;
export const EXPORT_TIMEOUT_MLS = getIntEnvVariable('EXPORT_TIMEOUT_MLS', 1000 * 60 * 5); // 5 minutes
export const EXPORT_BLOCKS_LIST_MAX_INTERVAL = getIntEnvVariable('EXPORT_BLOCKS_LIST_MAX_INTERVAL', 50);
export const START_BLOCK = getIntEnvVariable('START_BLOCK', 0) - 1;
export const START_PRIMARY_KEY = getIntEnvVariable('START_PRIMARY_KEY', -1);
export const WRITE_SIGNAL_RECORDS_KAFKA = getBoolEnvVariable('WRITE_SIGNAL_RECORDS_KAFKA', false);
export const KAFKA_TOPIC = process.env.KAFKA_TOPIC;
export const TEST_ENV = getBoolEnvVariable('TEST_ENV', false);

