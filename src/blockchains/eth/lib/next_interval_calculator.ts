export const WORK_NO_SLEEP = 0;
export const WORK_SLEEP = 1;
export const NO_WORK_SLEEP = 2;

/**
 * Returns the context in which the worker finds itself at a given moment:
 *
 * WORK_NO_SLEEP : Exporting blocks that are behind the last confirmed block
 *
 * WORK_SLEEP : We've caught up to the last confirmed block. After a query to the node,
 * we find out that there's a higher goal
 *
 * NO_WORK_SLEEP : We've caught up to the last confirmed block. After a query to the node,
 * we find out that we've caught up
 *
 * @param {BaseWorker} worker A worker instance, inherriting the BaseWorker class.
 * @returns {number} A number, which points to one of the above-given scenarios
 */
export async function analyzeWorkerContext(worker: any) {
  if (worker.lastExportedBlock < worker.lastConfirmedBlock) return WORK_NO_SLEEP;

  const newConfirmedBlock = await worker.web3Wrapper.getBlockNumber() - worker.settings.CONFIRMATIONS;
  if (newConfirmedBlock > worker.lastConfirmedBlock) {
    worker.lastConfirmedBlock = newConfirmedBlock;
    return WORK_SLEEP;
  }

  return NO_WORK_SLEEP;
}

/**
 * Function for setting the work loop's sleep time, after the end of the worker's work method.
 * @param {BaseWorker} worker A worker instance, inherriting the BaseWorker class.
 * @param {number} context The scenario used for setting the sleep time
 */
export function setWorkerSleepTime(worker: any, context: any) {
  worker.sleepTimeMsec = (context !== WORK_NO_SLEEP) ? worker.settings.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000 : 0;
}

export type BlockInterval = {
  fromBlock: number;
  toBlock: number;
}

/**
 * Function for calculating the next interval to be used in the worker's methods for querying the node.
 * @param {BaseWorker} worker A worker instance, inherriting the BaseWorker class.
 * @returns {object} The interval, derived from the progress of the worker
 */
export function nextIntervalCalculator(worker: any): BlockInterval {
  return {
    fromBlock: worker.lastExportedBlock + 1,
    toBlock: Math.min(worker.lastExportedBlock + worker.settings.BLOCK_INTERVAL, worker.lastConfirmedBlock)
  };
}

module.exports = {
  WORK_SLEEP,
  NO_WORK_SLEEP,
  WORK_NO_SLEEP,
  setWorkerSleepTime,
  analyzeWorkerContext,
  nextIntervalCalculator
};
