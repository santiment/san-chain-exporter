function isNewBlockAvailable(worker) {
  return worker.lastExportedBlock < worker.lastConfirmedBlock;
}
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
  // Check if we need to ask the Node for new Head block. This is an optimization to skip this call when the exporter
  // is behind the last seen Head anyways.
  const firstNewBlockCheck = isNewBlockAvailable(worker);
  if (!firstNewBlockCheck) {
    // On the previous cycle we closed the gap to the head of the blockchain.
    // Check if there are new blocks now.
    const newConfirmedBlock = await worker.web3Wrapper.getBlockNumber() - worker.constants.CONFIRMATIONS;
    if (newConfirmedBlock > worker.lastConfirmedBlock) {
      // The Node has progressed
      worker.lastConfirmedBlock = newConfirmedBlock;
    }
  }

  if (firstNewBlockCheck || isNewBlockAvailable(worker)) {
    // If data was available without asking with Node, we are catching up and should come back straight away
    if (firstNewBlockCheck) {
      worker.sleepTimeMsec = 0;
    }
    else {
      // If data became available only after asking the Node, we are close to the Head, come back later
      worker.sleepTimeMsec = worker.constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;
    }

    return {
      success: true,
      fromBlock: worker.lastExportedBlock + 1,
      toBlock: Math.min(worker.lastExportedBlock + worker.constants.BLOCK_INTERVAL, worker.lastConfirmedBlock)
    };
  }
  else {
    // The Node has not progressed
    worker.sleepTimeMsec = worker.constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;
    return { success: false };
  }
}

module.exports = {
  nextIntervalCalculator
};
