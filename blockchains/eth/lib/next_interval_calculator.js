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
  if (worker.lastConfirmedBlock === worker.lastExportedBlock) {
    // We are up to date with the blockchain (aka 'current mode'). Sleep longer after finishing this loop.
    worker.sleepTimeMsec = constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;

    // On the previous cycle we closed the gap to the head of the blockchain.
    // Check if there are new blocks now.
    const newConfirmedBlock = await worker.web3.eth.getBlockNumber() - constants.CONFIRMATIONS;
    if (newConfirmedBlock > worker.lastConfirmedBlock) {
      // The Node has progressed
      worker.lastConfirmedBlock = newConfirmedBlock;
      worker.isNodeProgressed = true;
    }
    else {
      // The Node has not progressed or may have even go backwards
      return { success: false };
    }
  }
  else {
    // We are still catching with the blockchain (aka 'historic mode'). Do not sleep after this loop.
    worker.sleepTimeMsec = 0;
  }

  return {
    success: true,
    fromBlock: worker.lastExportedBlock + 1,
    toBlock: Math.min(worker.lastExportedBlock + constants.BLOCK_INTERVAL, worker.lastConfirmedBlock)
  };
}

module.exports = {
  nextIntervalCalculator
};
