const { logger } = require('../../../lib/logger')

function decodeTransferTrace(trace, timestamp, web3Wrapper) {
  // Block & uncle rewards
  if (trace["type"] == "reward") {
    return {
      from: `mining_${trace["action"]["rewardType"]}`,
      to: trace["action"]["author"],
      value: web3Wrapper.parseValue(trace["action"]["value"]),
      valueExactBase36: web3Wrapper.parseValueBase36(trace["action"]["value"]),
      blockNumber: trace["blockNumber"],
      timestamp: timestamp,
      type: trace["type"]
    }
  }

  // Contract creation
  if (trace["type"] == "create") {
    return {
      from: trace["action"]["from"],
      to: trace["result"]["address"],
      value: web3Wrapper.parseValue(trace["action"]["value"]),
      valueExactBase36: web3Wrapper.parseValueBase36(trace["action"]["value"]),
      blockNumber: trace["blockNumber"],
      timestamp: timestamp,
      transactionHash: trace["transactionHash"],
      transactionPosition: web3Wrapper.parseTransactionPosition(trace["transactionPosition"]),
      type: trace["type"]
    }
  }

  if (trace["type"] == "suicide") {
    return {
      from: trace["action"]["address"],
      to: trace["action"]["refundAddress"],
      value: web3Wrapper.parseBalance(trace["action"]["balance"]),
      valueExactBase36: web3Wrapper.parseBalanceBase36(trace["action"]["balance"]),
      blockNumber: trace["blockNumber"],
      timestamp: timestamp,
      transactionHash: trace["transactionHash"],
      transactionPosition: web3Wrapper.parseTransactionPosition(trace["transactionPosition"]),
      type: trace["type"]
    }
  }

  if (trace["type"] != "call") {
    logger.warn("Unknown trace type: " + JSON.stringify(trace))
  }

  return {
    from: trace["action"]["from"],
    to: trace["action"]["to"],
    value: web3Wrapper.parseValue(trace["action"]["value"]),
    valueExactBase36: web3Wrapper.parseValueBase36(trace["action"]["value"]),
    blockNumber: trace["blockNumber"],
    timestamp: timestamp,
    transactionHash: trace["transactionHash"],
    transactionPosition: web3Wrapper.parseTransactionPosition(trace["transactionPosition"]),
    type: trace["type"]
  }
}

module.exports = {
  decodeTransferTrace
}
