const BLOCK_INTERVAL = parseInt(process.env.BLOCK_INTERVAL || "100")
const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || "3")
const PARITY_NODE = process.env.PARITY_URL || "http://localhost:8545/"
const LOOP_INTERVAL_CURRENT_MODE_SEC = parseInt(process.env.LOOP_INTERVAL_CURRENT_MODE_SEC || "30")
const BURN_ADDRESS = "burn"
const LONDON_FORK_BLOCK = 12965000

module.exports = {
    BLOCK_INTERVAL,
    CONFIRMATIONS,
    PARITY_NODE,
    LOOP_INTERVAL_CURRENT_MODE_SEC,
    BURN_ADDRESS,
    LONDON_FORK_BLOCK
}
