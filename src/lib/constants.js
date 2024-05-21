const BLOCKCHAIN = process.env.BLOCKCHAIN;
const CONFIG_PATH = process.env.CONFIG_PATH;
const RPC_USERNAME = process.env.RPC_USERNAME || 'rpcuser';
const RPC_PASSWORD = process.env.RPC_PASSWORD || 'rpcpassword';
const EXPORT_BLOCKS_LIST = process.env.EXPORT_BLOCKS_LIST || false;
const EXPORT_TIMEOUT_MLS = parseInt(process.env.EXPORT_TIMEOUT_MLS) || 1000 * 60 * 5; // 5 minutes
const EXPORT_BLOCKS_LIST_MAX_INTERVAL = parseInt(process.env.EXPORT_BLOCKS_LIST_MAX_INTERVAL) || 50;
const START_BLOCK = parseInt(process.env.START_BLOCK || '0') - 1;
const START_PRIMARY_KEY = parseInt(process.env.START_PRIMARY_KEY || '-1');
const WRITE_SIGNAL_RECORDS_KAFKA = parseBoolean(process.env.WRITE_SIGNAL_RECORDS_KAFKA);
const KAFKA_TOPIC = process.env.KAFKA_TOPIC;

function parseBoolean(value) {
  if (value === undefined) return false;
  const lowerCasedValue = value.trim().toLowerCase();
  return lowerCasedValue === 'true' || lowerCasedValue === '1';
}

module.exports = {
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
  KAFKA_TOPIC
};
