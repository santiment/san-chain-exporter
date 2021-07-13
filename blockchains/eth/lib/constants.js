const BLOCK_INTERVAL = parseInt(process.env.BLOCK_INTERVAL || "100")
const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || "3")
const EXPORT_TIMEOUT_MLS = parseInt(process.env.EXPORT_TIMEOUT_MLS || 1000 * 60 * 5)     // 5 minutes
const PARITY_NODE = process.env.PARITY_URL || "http://localhost:8545/"
const LOOP_INTERVAL_CURRENT_MODE_SEC = parseInt(process.env.LOOP_INTERVAL_CURRENT_MODE_SEC || "30")

module.exports = {
    BLOCK_INTERVAL,
    CONFIRMATIONS,
    EXPORT_TIMEOUT_MLS,
    PARITY_NODE,
    LOOP_INTERVAL_CURRENT_MODE_SEC
}