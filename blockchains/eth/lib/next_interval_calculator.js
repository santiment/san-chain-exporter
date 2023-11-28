const constants = require('./constants');

/**
 * A function that returns the appropriate array of intervals,
 * depending on the progress that the worker's made.
 * If the exporter's caught up, we check for a new block. We then check whether the Node
 * returns a valid block (sometimes the Node returns an early block, like 3 for example).
 * We don't want to get the new blocks right away, so we set a sleep variable. On the next iteration
 * the function will return the appropriate array of intervals.
 * @param {BaseWorker} worker A worker instance, inherriting the BaseWorker class.
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
  const progressDifference = worker.lastConfirmedBlock - worker.lastExportedBlock;
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
