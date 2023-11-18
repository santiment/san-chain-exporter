const constants = require('./constants');

/**
 * Return the next interval to be fetched.
 * NOTE: this method modifies the member variables of its argument
 *
 * @param {*} worker A worker object, member variables would be modified
 * @returns An object like so:
 * {
 *  success: Boolean,
 *  fromBlock: Integer,
 *  toBlock: Integer
 * }
 */
async function nextIntervalCalculator(worker) {
  if (worker.lastExportedBlock >= worker.lastConfirmedBlock) {
    const newConfirmedBlock = await worker.web3.eth.getBlockNumber() - constants.CONFIRMATIONS;
    if (worker.lastConfirmedBlock <= newConfirmedBlock) {
      worker.sleepTimeMsec = constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;
      return [];
    }
  }
  worker.sleepTimeMsec = 0;
  const numConcurrentRequests = Math.min(constants.MAX_CONCURRENT_REQUESTS, this.lastConfirmedBlock - this.lastExportedBlock || Infinity);
  return Array.from({ length: numConcurrentRequests }, (_, i) => {
    return {
      fromBlock: worker.lastExportedBlock + constants.BLOCK_INTERVAL * i + 1,
      toBlock: Math.min(worker.lastExportedBlock + constants.BLOCK_INTERVAL * (i + 1), worker.lastConfirmedBlock)
    };
  });
}

module.exports = {
  nextIntervalCalculator
};
