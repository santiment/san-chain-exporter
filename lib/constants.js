const EXPORT_TIMEOUT_MLS = parseInt(process.env.EXPORT_TIMEOUT_MLS || 1000 * 60 * 5)     // 5 minutes
const PARITY_NODE = process.env.PARITY_URL || "http://localhost:8545/"

module.exports = {
    EXPORT_TIMEOUT_MLS,
    PARITY_NODE
}
