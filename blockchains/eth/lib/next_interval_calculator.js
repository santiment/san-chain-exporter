const constants = require('./constants');

/**
 * A function that returns the appropriate array of intervals,
 * depending on the progress that the worker's made.
 * @param {BaseWorker} worker The worker instance.
 * @returns {Array} An array of intervals.
 */
async function nextIntervalCalculator(worker) {
  if (worker.lastExportedBlock >= worker.lastConfirmedBlock) {
    const newConfirmedBlock = await worker.web3.eth.getBlockNumber() - constants.CONFIRMATIONS;
    if (worker.lastConfirmedBlock < newConfirmedBlock) {
      worker.lastConfirmedBlock = newConfirmedBlock;
    }
    worker.sleepTimeMsec = constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;
    return [];
  }

  worker.sleepTimeMsec = 0;
  const progressDifference = this.lastConfirmedBlock - this.lastExportedBlock;
  const maxInterval = constants.MAX_CONCURRENT_REQUESTS * constants.BLOCK_INTERVAL;
  let intervalArrayLength;
  if (progressDifference < maxInterval) {
    intervalArrayLength = Math.ceil(progressDifference / constants.BLOCK_INTERVAL);
  } else {
    intervalArrayLength = constants.MAX_CONCURRENT_REQUESTS;
  }

  return Array.from({ length: intervalArrayLength }, (_, i) => {
    return {
      fromBlock: worker.lastExportedBlock + constants.BLOCK_INTERVAL * i + 1,
      toBlock: Math.min(worker.lastExportedBlock + constants.BLOCK_INTERVAL * (i + 1), worker.lastConfirmedBlock)
    };
  });
}

module.exports = {
  nextIntervalCalculator
};
