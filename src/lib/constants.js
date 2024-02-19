const BLOCKCHAIN = process.env.BLOCKCHAIN;
const CONFIG_PATH = process.env.CONFIG_PATH;
const EXPORT_BLOCKS_LIST = process.env.EXPORT_BLOCKS_LIST || false;
const EXPORT_TIMEOUT_MLS = parseInt(process.env.EXPORT_TIMEOUT_MLS) || 1000 * 60 * 5; // 5 minutes
const EXPORT_BLOCKS_LIST_MAX_INTERVAL = parseInt(process.env.EXPORT_BLOCKS_LIST_MAX_INTERVAL) || 50;
const START_BLOCK = parseInt(process.env.START_BLOCK || '0') - 1;
const START_PRIMARY_KEY = parseInt(process.env.START_PRIMARY_KEY || '-1');

module.exports = {
  BLOCKCHAIN,
  CONFIG_PATH,
  EXPORT_BLOCKS_LIST,
  EXPORT_TIMEOUT_MLS,
  EXPORT_BLOCKS_LIST_MAX_INTERVAL,
  START_BLOCK,
  START_PRIMARY_KEY
};