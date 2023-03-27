const Web3 = require('web3');
const lang = require('lodash/lang');
const array = require('lodash/array');
const object = require('lodash/object');
const collection = require('lodash/collection');

const parseReceipts = (responses) => {
  const receipts = responses.map((response) => response['result']);
  return array.compact(array.flatten(receipts));
};

const parseBlocks = (responses) => {
  return responses.map((response) => response['result']);
};

const parseTransactionReceipts = (responses) => {
  const receipts = responses.map((response) => response['result']);
  return receipts;
};

const decodeLog = (log) => {
  collection.forEach(['blockNumber', 'blockHash', 'transactionHash', 'transactionIndex'],
  key => object.unset(log, key));

  collection.forEach(['logIndex', 'transactionLogIndex'],
    key => log[key] = Web3.utils.hexToNumber(log[key])
  );

  return log;
};

const columnizeLogs = (logs) => {
  if (logs.length === 0) { return []; }

  const decodedLogs = collection.map(logs, decodeLog);
  const logKeys = object.keys(decodedLogs[0]);
  const result = {};
  collection.forEach(logKeys, key => result[`logs.${key}`] = decodedLogs.map(log => log[key]));

  return result;
};

const decodeReceipt = (receipt) => {
  const clonedReceipt = lang.clone(receipt);

  collection.forEach(['blockNumber', 'status', 'transactionIndex'],
    key => clonedReceipt[key] = Web3.utils.hexToNumber(clonedReceipt[key])
  );

  collection.forEach(['cumulativeGasUsed', 'gasUsed'],
    key => clonedReceipt[key] = Web3.utils.hexToNumberString(clonedReceipt[key])
  );

  object.merge(clonedReceipt, columnizeLogs(clonedReceipt['logs']));
  object.unset(clonedReceipt, 'logs');

  return clonedReceipt;
};

const decodeBlock = (block) => {
  return {
    timestamp: Web3.utils.hexToNumber(block.timestamp),
    number: Web3.utils.hexToNumber(block.number)
  };
};

const prepareBlockTimestampsObject = async (blocks) => {
  let obj = {};
  for (const block of blocks) { obj[block.number] = block.timestamp; }

  return obj;
};

const setReceiptsTimestamp = async (receipts, timestamps) => {
  return collection.forEach(receipts, receipt =>  receipt['timestamp'] = timestamps[receipt.blockNumber]);
};

module.exports = {
  parseReceipts,
  parseBlocks,
  parseTransactionReceipts,
  decodeLog,
  columnizeLogs,
  decodeReceipt,
  decodeBlock,
  prepareBlockTimestampsObject,
  setReceiptsTimestamp
};
