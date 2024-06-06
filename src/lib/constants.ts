import { getBoolEnvVariable, getIntEnvVariable } from "./utils"


const BLOCKCHAIN = process.env.BLOCKCHAIN;
const CONFIG_PATH = process.env.CONFIG_PATH;
const RPC_USERNAME = process.env.RPC_USERNAME || 'rpcuser';
const RPC_PASSWORD = process.env.RPC_PASSWORD || 'rpcpassword';
const EXPORT_BLOCKS_LIST = process.env.EXPORT_BLOCKS_LIST || false;
const EXPORT_TIMEOUT_MLS = getIntEnvVariable('EXPORT_TIMEOUT_MLS', 1000 * 60 * 5); // 5 minutes
const EXPORT_BLOCKS_LIST_MAX_INTERVAL = getIntEnvVariable('EXPORT_BLOCKS_LIST_MAX_INTERVAL', 50);
const START_BLOCK = getIntEnvVariable('START_BLOCK', 0) - 1;
const START_PRIMARY_KEY = getIntEnvVariable('START_PRIMARY_KEY', -1);
const WRITE_SIGNAL_RECORDS_KAFKA = getBoolEnvVariable('WRITE_SIGNAL_RECORDS_KAFKA', false);
const KAFKA_TOPIC = process.env.KAFKA_TOPIC;
const TEST_ENV = getBoolEnvVariable('TEST_ENV', false);

export {
  BLOCKCHAIN,
  CONFIG_PATH,
  RPC_USERNAME,
  RPC_PASSWORD,
  EXPORT_BLOCKS_LIST,
  EXPORT_TIMEOUT_MLS,
  EXPORT_BLOCKS_LIST_MAX_INTERVAL,
  START_BLOCK,
  START_PRIMARY_KEY,
  WRITE_SIGNAL_RECORDS_KAFKA,
  KAFKA_TOPIC,
  TEST_ENV
};
