const BLOCK_INTERVAL = parseInt(process.env.BLOCK_INTERVAL || '100');
const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || '3');
const EXPORT_BLOCKS_LIST = process.env.EXPORT_BLOCKS_LIST || false;
// This multiplier is used to expand the space of the output primary keys.
//This allows for the event indexes to be added to the primary key.
const PRIMARY_KEY_MULTIPLIER = 10000;
// We support three modes of operation
// "vanilla" - extract events as seen on the blockchain
// "extract_exact_overwrite" - extract only specified list of contracts, overwrite contract names
// "extract_all_append" - extract all contracts, also append events with overwritten contract name
const CONTRACT_MODES_SUPPORTED = ['vanilla', 'extract_exact_overwrite', 'extract_all_append'];
const CONTRACT_MODE = process.env.CONTRACT_MODE || 'vanilla';
const NODE_URL = process.env.NODE_URL || process.env.PARITY_URL || 'http://localhost:8545/';
const MAX_CONCURRENT_REQUESTS = parseInt(process.env.MAX_CONCURRENT_REQUESTS || 1);

const CONTRACT_MAPPING_FILE_PATH = (
    process.env.CONTRACT_MAPPING_FILE_PATH ?
        process.env.CONTRACT_MAPPING_FILE_PATH :
        './contract_mapping/contract_mapping.json'
);

const LOOP_INTERVAL_CURRENT_MODE_SEC = parseInt(process.env.LOOP_INTERVAL_CURRENT_MODE_SEC || '30');

function checkEnvVariables() {
    if (!CONTRACT_MODES_SUPPORTED.includes(CONTRACT_MODE)) {
        throw new Error(`"${CONTRACT_MODE}" mode is not supported`);
    }
}

checkEnvVariables();

module.exports = {
    BLOCK_INTERVAL,
    CONFIRMATIONS,
    EXPORT_BLOCKS_LIST,
    PRIMARY_KEY_MULTIPLIER,
    CONTRACT_MODE,
    NODE_URL,
    CONTRACT_MAPPING_FILE_PATH,
    LOOP_INTERVAL_CURRENT_MODE_SEC,
    MAX_CONCURRENT_REQUESTS
};
