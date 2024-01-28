/**
 * Returns the context in which the worker finds itself at a given moment:
 * 
 * 0 : Exporting blocks that are behind the last confirmed block
 * 
 * 1 : We've caught up to the last confirmed block. After a query to the node, we find out that there's a higher goal
 * 
 * 2 : We've caught up to the last confirmed block. After a query to the node, we find out that we've caught up
 * 
 * @param {BaseWorker} worker A worker instance, inherriting the BaseWorker class.
 * @returns {number} A number, which points to one of the above-given scenarios
 */
async function analyzeWorkerProgress(worker) {
  if (worker.lastExportedBlock < worker.lastConfirmedBlock) return 0;

  const newConfirmedBlock = await worker.web3Wrapper.getBlockNumber() - worker.settings.CONFIRMATIONS;
  if (newConfirmedBlock > worker.lastConfirmedBlock) {
    worker.lastConfirmedBlock = newConfirmedBlock;
    return 1;
  }

  return 2;
}

/**
 * Function for setting the work loop's sleep time, after the end of the worker's work method.
 * For the above given 0 and 1 scenarios, we'd want no sleep, because we have to work.
 * For 2 we'd want to sleep, because we'd have caught up completely and should back off for some time.
 * @param {BaseWorker} worker A worker instance, inherriting the BaseWorker class.
 * @param {number} context The scenario used for setting the sleep time
 */
function setWorkerSleepTime(worker, context) {
  worker.sleepTimeMsec = (context === 2) ? worker.settings.LOOP_INTERVAL_CURRENT_MODE_SEC : 0;
}

/**
 * Function for calculating the next interval to be used in the worker's methods for querying the node.
 * @param {BaseWorker} worker A worker instance, inherriting the BaseWorker class.
 * @returns {object} The interval, derived from the progress of the worker
 */
function nextIntervalCalculator(worker) {
  return {
    fromBlock: worker.lastExportedBlock + 1,
    toBlock: Math.min(worker.lastExportedBlock + worker.settings.BLOCK_INTERVAL, worker.lastConfirmedBlock)
  };
}

module.exports = {
  setWorkerSleepTime,
  analyzeWorkerProgress,
  nextIntervalCalculator
};
