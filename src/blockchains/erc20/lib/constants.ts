import { getBoolEnvVariable, getIntEnvVariable } from '../../../lib/utils.js';

const BLOCK_INTERVAL = getIntEnvVariable('BLOCK_INTERVAL', 100);
const CONFIRMATIONS = getIntEnvVariable('CONFIRMATIONS', 3);
const EXPORT_BLOCKS_LIST = getBoolEnvVariable('EXPORT_BLOCKS_LIST', false);
// This multiplier is used to expand the space of the output primary keys.
//This allows for the event indexes to be added to the primary key.
const PRIMARY_KEY_MULTIPLIER = 10000;
// We support three modes of operation
// "vanilla" - extract events as seen on the blockchain
// "extract_exact_overwrite" - extract only specified list of contracts, overwrite contract names
// "extract_all_append" - extract all contracts, also append events with overwritten contract name
const CONTRACT_MODES_SUPPORTED = ['vanilla', 'extract_exact_overwrite', 'extract_all_append'];
const CONTRACT_MODE = process.env.CONTRACT_MODE || 'vanilla';
const NODE_URL = process.env.NODE_URL || 'http://localhost:8545/';
// Should events for a contract land in the same Kafka partition
const EVENTS_IN_SAME_PARTITION = process.env.EVENTS_IN_SAME_PARTITION || false;
const DEFAULT_TIMEOUT = getIntEnvVariable('DEFAULT_TIMEOUT', 10000);


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

export {
    BLOCK_INTERVAL,
    CONFIRMATIONS,
    EXPORT_BLOCKS_LIST,
    PRIMARY_KEY_MULTIPLIER,
    CONTRACT_MODE,
    NODE_URL,
    CONTRACT_MAPPING_FILE_PATH,
    LOOP_INTERVAL_CURRENT_MODE_SEC,
    EVENTS_IN_SAME_PARTITION,
    DEFAULT_TIMEOUT
};

