const BLOCK_INTERVAL = parseInt(process.env.BLOCK_INTERVAL || "100")
const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || "3")
const EXPORT_TIMEOUT_MLS = parseInt(process.env.EXPORT_TIMEOUT_MLS || 1000 * 60 * 5)     // 5 minutes
const LOOP_INTERVAL_CURRENT_MODE_SEC = parseInt(process.env.LOOP_INTERVAL_CURRENT_MODE_SEC || "30")

module.exports = {
    BLOCK_INTERVAL,
    CONFIRMATIONS,
    EXPORT_TIMEOUT_MLS,
    LOOP_INTERVAL_CURRENT_MODE_SEC
}