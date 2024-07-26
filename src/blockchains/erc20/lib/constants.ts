import { getBoolEnvVariable, getIntEnvVariable } from '../../../lib/utils';

export const BLOCK_INTERVAL = getIntEnvVariable('BLOCK_INTERVAL', 100);
export const CONFIRMATIONS = getIntEnvVariable('CONFIRMATIONS', 3);
export const EXPORT_BLOCKS_LIST = getBoolEnvVariable('EXPORT_BLOCKS_LIST', false);
// This multiplier is used to expand the space of the output primary keys.
//This allows for the event indexes to be added to the primary key.
export const PRIMARY_KEY_MULTIPLIER = 10000;
// We support three modes of operation
// "vanilla" - extract events as seen on the blockchain
// "extract_exact_overwrite" - extract only specified list of contracts, overwrite contract names
// "extract_all_append" - extract all contracts, also append events with overwritten contract name
export const CONTRACT_MODES_SUPPORTED = ['vanilla', 'extract_exact_overwrite', 'extract_all_append'];
export const CONTRACT_MODE = process.env.CONTRACT_MODE || 'vanilla';
export const NODE_URL = process.env.NODE_URL || 'http://localhost:8545/';
// Should events for a contract land in the same Kafka partition
export const EVENTS_IN_SAME_PARTITION = process.env.EVENTS_IN_SAME_PARTITION || false;
export const DEFAULT_TIMEOUT = getIntEnvVariable('DEFAULT_TIMEOUT', 10000);
export const EXTEND_TRANSFERS_WITH_BALANCES = process.env.EXTEND_TRANSFERS_WITH_BALANCES || false;
export const MULTICALL_DEPLOY_BLOCK = getIntEnvVariable('MULTICALL_DEPLOY_BLOCK', 14353601);

export const CONTRACT_MAPPING_FILE_PATH = (
    process.env.CONTRACT_MAPPING_FILE_PATH ?
        process.env.CONTRACT_MAPPING_FILE_PATH :
        './contract_mapping/contract_mapping.json'
);

export const LOOP_INTERVAL_CURRENT_MODE_SEC = parseInt(process.env.LOOP_INTERVAL_CURRENT_MODE_SEC || '30');

function checkEnvVariables() {
    if (!CONTRACT_MODES_SUPPORTED.includes(CONTRACT_MODE)) {
        throw new Error(`"${CONTRACT_MODE}" mode is not supported`);
    }
}

checkEnvVariables();


