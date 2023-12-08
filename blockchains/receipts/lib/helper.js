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

const decodeLog = (log, web3Wrapper) => {
  collection.forEach(['blockNumber', 'blockHash', 'transactionHash', 'transactionIndex'],
    key => object.unset(log, key));

  collection.forEach(['logIndex', 'transactionLogIndex'],
    key => {
      if (Object.prototype.hasOwnProperty.call(log, key) && log[key] !== undefined) {
        log[key] = web3Wrapper.parseHexToNumber(log[key]);
      }
    }
  );

  return log;
};

const columnizeLogs = (logs, web3Wrapper) => {
  if (logs.length === 0) { return []; }

  const decodedLogs = collection.map(logs, log => decodeLog(log, web3Wrapper));
  const logKeys = object.keys(decodedLogs[0]);
  const result = {};
  collection.forEach(logKeys, key => result[`logs.${key}`] = decodedLogs.map(log => log[key]));

  return result;
};

const decodeReceipt = (receipt, web3Wrapper) => {
  const clonedReceipt = lang.cloneDeep(receipt);

  collection.forEach(['blockNumber', 'status', 'transactionIndex'],
    key => {
      if (Object.prototype.hasOwnProperty.call(clonedReceipt, key) && clonedReceipt[key] !== undefined) {
        clonedReceipt[key] = web3Wrapper.parseHexToNumber(clonedReceipt[key]);
      }
    }
  );

  collection.forEach(['cumulativeGasUsed', 'gasUsed'],
    key => clonedReceipt[key] = web3Wrapper.parseHexToNumberString(clonedReceipt[key])
  );

  object.merge(clonedReceipt, columnizeLogs(clonedReceipt['logs'], web3Wrapper));
  object.unset(clonedReceipt, 'logs');

  return clonedReceipt;
};

const decodeBlock = (block, web3Wrapper) => {
  return {
    timestamp: web3Wrapper.parseHexToNumber(block.timestamp),
    number: web3Wrapper.parseHexToNumber(block.number)
  };
};

const prepareBlockTimestampsObject = (blocks) => {
  let obj = {};
  for (const block of blocks) { obj[block.number] = block.timestamp; }

  return obj;
};

const setReceiptsTimestamp = async (receipts, timestamps) => {
  return collection.forEach(receipts, receipt => receipt['timestamp'] = timestamps[receipt.blockNumber]);
};

module.exports = {
  parseReceipts,
  parseBlocks,
  parseTransactionReceipts,
  decodeLog,
  decodeReceipt,
  decodeBlock,
  prepareBlockTimestampsObject,
  setReceiptsTimestamp
};
