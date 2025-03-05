const lang = require('lodash/lang');
const array = require('lodash/array');
const object = require('lodash/object');
const collection = require('lodash/collection');

import { ETHBlock } from '../../eth/eth_types';
import { Web3Static, safeCastToNumber } from '../../eth/lib/web3_wrapper';

export function parseReceipts(responses: any[]) {
  const receipts = responses.map((response: any) => response['result']);
  return array.compact(array.flatten(receipts));
};

export function parseBlocks(responses: any[]) {
  return responses.map((response: any) => response['result']);
};

export function parseTransactionReceipts(responses: any[]) {
  const receipts = responses.map((response) => response['result']);
  return receipts;
};

function decodeLog(log: any) {
  collection.forEach(['blockNumber', 'blockHash', 'transactionHash', 'transactionIndex'],
    (key: any) => object.unset(log, key));

  collection.forEach(['logIndex', 'transactionLogIndex'],
    (key: any) => {
      if (Object.prototype.hasOwnProperty.call(log, key) && log[key] !== undefined) {
        log[key] = Web3Static.parseHexToNumber(log[key]);
      }
      else {
        log[key] = null;
      }
    }
  );

  return log;
};

function columnizeLogs(logs: any[]) {
  if (logs.length === 0) { return []; }

  const decodedLogs = collection.map(logs, (log: any) => decodeLog(log));
  const logKeys = object.keys(decodedLogs[0]);
  const result: any = {};
  collection.forEach(logKeys, (key: any) => result[`logs.${key}`] = decodedLogs.map((log: any) => log[key]));

  return result;
};

export function decodeReceipt(receipt: any) {
  const clonedReceipt = lang.cloneDeep(receipt);

  collection.forEach(['blockNumber', 'status', 'transactionIndex'],
    (key: any) => {
      if (Object.prototype.hasOwnProperty.call(clonedReceipt, key) && clonedReceipt[key] !== undefined) {
        clonedReceipt[key] = Web3Static.parseHexToNumber(clonedReceipt[key]);
      }
      else {
        clonedReceipt[key] = null;
      }
    }
  );

  collection.forEach(['cumulativeGasUsed', 'gasUsed'],
    (key: any) => clonedReceipt[key] = Web3Static.parseHexToNumberString(clonedReceipt[key])
  );

  object.merge(clonedReceipt, columnizeLogs(clonedReceipt['logs']));
  object.unset(clonedReceipt, 'logs');

  return clonedReceipt;
};

export function decodeBlock(block: ETHBlock): { timestamp: number; number: number } {
  return {
    timestamp: safeCastToNumber(Web3Static.parseHexToNumber(block.timestamp)),
    number: safeCastToNumber(Web3Static.parseHexToNumber(block.number))
  };
};


export function prepareBlockTimestampsObject(blocks: { timestamp: number; number: number }[]): Record<number, number> {
  let obj: Record<number, number> = {};
  for (const block of blocks) {
    obj[block.number] = block.timestamp;
  }

  return obj;
};

export function setReceiptsTimestamp(receipts: any[], timestamps: any) {
  return collection.forEach(receipts, (receipt: any) => receipt['timestamp'] = timestamps[receipt.blockNumber]);
};

