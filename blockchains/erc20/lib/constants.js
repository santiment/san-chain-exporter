const BLOCK_INTERVAL = parseInt(process.env.BLOCK_INTERVAL || "100")
const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || "3")
// This multiplier is used to expand the space of the output primary keys.
//This allows for the event indexes to be added to the primary key.
const PRIMARY_KEY_MULTIPLIER = 10000
const EXPORT_TIMEOUT_MLS = parseInt(process.env.EXPORT_TIMEOUT_MLS || 1000 * 60 * 5)     // 5 minutes
// When run in this mode, only transfers for specific contracts would be fetched and contract address overwritten.
const EXACT_CONTRACT_MODE = parseInt(process.env.EXACT_CONTRACT_MODE || "0")
const PARITY_NODE = process.env.PARITY_URL || "http://localhost:8545/"
const CONTRACT_MAPPING_FILE_PATH = "./lib/contract_mapping/contract_mapping.json"

module.exports = {
    BLOCK_INTERVAL,
    CONFIRMATIONS,
    PRIMARY_KEY_MULTIPLIER,
    EXPORT_TIMEOUT_MLS,
    EXACT_CONTRACT_MODE,
    PARITY_NODE,
    CONTRACT_MAPPING_FILE_PATH
}
