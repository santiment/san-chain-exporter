const { logger } = require('../../../lib/logger');
const constants = require('./constants');

function decodeTransferTrace(trace, timestamp, web3Wrapper) {
  // Block & uncle rewards
  if (trace['type'] === 'reward') {
    if (constants.IS_ETH && parseInt(trace['blockNumber']) >= constants.THE_MERGE)
      return NaN;

    return {
      from: `mining_${trace['action']['rewardType']}`,
      to: trace['action']['author'],
      value: Number(web3Wrapper.parseHexToNumber(trace['action']['value'])),
      valueExactBase36: web3Wrapper.parseHexToBase36String(trace['action']['value']),
      blockNumber: trace['blockNumber'],
      timestamp: timestamp,
      type: trace['type']
    };
  }

  // Contract creation
  if (trace['type'] === 'create') {
    return {
      from: trace['action']['from'],
      to: trace['result']['address'],
      value: Number(web3Wrapper.parseHexToNumber(trace['action']['value'])),
      valueExactBase36: web3Wrapper.parseHexToBase36String(trace['action']['value']),
      blockNumber: trace['blockNumber'],
      timestamp: timestamp,
      transactionHash: trace['transactionHash'],
      transactionPosition: trace['transactionPosition'],
      type: trace['type']
    };
  }

  if (trace['type'] === 'suicide') {
    return {
      from: trace['action']['address'],
      to: trace['action']['refundAddress'],
      value: Number(web3Wrapper.parseHexToNumber(trace['action']['balance'])),
      valueExactBase36: web3Wrapper.parseHexToBase36String(trace['action']['balance']),
      blockNumber: trace['blockNumber'],
      timestamp: timestamp,
      transactionHash: trace['transactionHash'],
      transactionPosition: trace['transactionPosition'],
      type: trace['type']
    };
  }

  if (trace['type'] !== 'call') {
    logger.warn('Unknown trace type: ' + JSON.stringify(trace));
  }

  return {
    from: trace['action']['from'],
    to: trace['action']['to'],
    value: Number(web3Wrapper.parseHexToNumber(trace['action']['value'])),
    valueExactBase36: web3Wrapper.parseHexToBase36String(trace['action']['value']),
    blockNumber: trace['blockNumber'],
    timestamp: timestamp,
    transactionHash: trace['transactionHash'],
    transactionPosition: trace['transactionPosition'],
    type: trace['type']
  };
}

module.exports = {
  decodeTransferTrace
};
