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
  // Check if we are up to date with the blockchain (aka 'current mode').
  if (worker.lastExportedBlock >= worker.lastConfirmedBlock) {
    // On the previous cycle we closed the gap to the head of the blockchain.
    // Check if there are new blocks now.
    const newConfirmedBlock = await worker.web3.eth.getBlockNumber() - constants.CONFIRMATIONS;
    if (newConfirmedBlock > worker.lastConfirmedBlock) {
      // The Node has progressed
      worker.lastConfirmedBlock = newConfirmedBlock;
    }
  }

  if (worker.lastExportedBlock + constants.BLOCK_INTERVAL > worker.lastConfirmedBlock) {
    // The Node has not progressed enough to generate a new interval
    worker.sleepTimeMsec = constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;
    return { success: false };
  }
  else {
    // There is enough data to fetch right away
    worker.sleepTimeMsec = 0;

    return {
      success: true,
      fromBlock: worker.lastExportedBlock + 1,
      toBlock: worker.lastExportedBlock + constants.BLOCK_INTERVAL
    };
  }
}

module.exports = {
  nextIntervalCalculator
};
