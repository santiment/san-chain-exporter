const fs = require('fs');
const csv = require('csv-parser');
const { logger } = require('./logger');
const { CONFIG_PATH, EXPORT_BLOCKS_LIST_MAX_INTERVAL } = require('./constants');

/**
 * @returns {Promise} Promise, resolves to the csv data in array format
 */
async function getConfigMapList() {
  const csvData = [];
  const readStream = fs.createReadStream(CONFIG_PATH);
  return new Promise((resolve, reject) => {
    readStream
      .pipe(csv())
      .on('data', (data) => {
        const blockNumber = Object.values(data)[0];
        csvData.push(blockNumber);
      })
      .on('end', () => {
        logger.info('Processed data from config file');
        resolve(csvData);
      })
      .on('error', (err) => { reject(err); });
  });
}

/**
 * @param {number} start Start block number
 * @param {number} end End block number
 * @param {number} interval Maximum distance between blocks to be fetched
 * @returns {Array} Array of intervals
 */
function breakdownInterval(start, end) {
  const result = [];
  if (end - start <= EXPORT_BLOCKS_LIST_MAX_INTERVAL) {
    result.push([start, end]);
    return result;
  }
  let currStart = start;
  let currEnd = start + EXPORT_BLOCKS_LIST_MAX_INTERVAL - 1;
  while (currEnd < end) {
    result.push([currStart, currEnd]);
    currStart = currEnd + 1;
    currEnd = currStart + EXPORT_BLOCKS_LIST_MAX_INTERVAL - 1;
  }
  result.push([currStart, end]);
  return result;
}

/**
 * @param {Array} data Sorted array of block numbers in ascending order
 * @returns {Array} Array of intervals
 */
function makeIntervals(data) {
  if (data.length === 0) {
    return [];
  }
  const intervals = [];
  let start = data[0];
  let end = data[0];
  for (let i = 1; i < data.length; i++) {
    if (data[i] - data[i - 1] === 1) {
      end = data[i];
    } else {
      intervals.push(...breakdownInterval(start, end));
      start = data[i];
      end = data[i];
    }
  }
  intervals.push(...breakdownInterval(start, end));
  return intervals;
}

/**
 * @returns {Array} Array of blocks list intervals
 */
async function initBlocksList() {
  const blockNumbers = await getConfigMapList();
  const intervals = makeIntervals(
    blockNumbers.map((blockNumber) => parseInt(blockNumber))
  );
  return intervals;
}

module.exports = {
  initBlocksList
};
