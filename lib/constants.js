const BLOCKCHAIN = process.env.BLOCKCHAIN;
const EXPORT_TIMEOUT_MLS = parseInt(process.env.EXPORT_TIMEOUT_MLS || 1000 * 60 * 5);     // 5 minutes

module.exports = {
    BLOCKCHAIN,
    EXPORT_TIMEOUT_MLS
};
