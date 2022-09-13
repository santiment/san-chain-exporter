const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || '3');
const LOOP_INTERVAL_CURRENT_MODE_SEC = parseInt(process.env.LOOP_INTERVAL_CURRENT_MODE_SEC || '30');

module.exports = {
    CONFIRMATIONS,
    LOOP_INTERVAL_CURRENT_MODE_SEC
};
