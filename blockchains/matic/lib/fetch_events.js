"use strict";
const { getBlockTimestamp, decodeEvents } = require('../../erc20/lib/fetch_events')
const { decodeAddress } = require('../../erc20/lib/util')

const MATIC_ADDRESS = "0x0000000000000000000000000000000000001010"


async function decodeEventBasicInfo(web3, event, blockTimestamps) {
  let timestamp
  if (!blockTimestamps[event["blockNumber"]]) {
    timestamp = blockTimestamps[event["blockNumber"]] = await getBlockTimestamp(web3, event["blockNumber"])
  } else {
    timestamp = blockTimestamps[event["blockNumber"]]
  }

  return {
    blockNumber: parseInt(web3.utils.hexToNumberString(event["blockNumber"])),
    timestamp: timestamp,
    transactionHash: event["transactionHash"],
    logIndex: parseInt(web3.utils.hexToNumberString(event["logIndex"]))
  }
}

/**Transfer(address,address,uint256)
 * Used by all Polygon ERC20 tokens
 **/
async function decodeTransferEvent(web3, event, blockTimestamps) {
  if (event["topics"].length != 4) {
    return null
  }

  let result = await decodeEventBasicInfo(web3, event, blockTimestamps)

  result.from = decodeAddress(event["topics"][2])
  result.to = decodeAddress(event["topics"][3])
  result.value = parseFloat(web3.utils.hexToNumberString(event["data"].substring(0,66)))
  result.valueExactBase36 = web3.utils.toBN(event["data"].substring(0,66)).toString(36)

  return result
}

// hashes generated with https://emn178.github.io/online-tools/keccak_256.html
const decodeFunctions = {
  // LogTransfer(address,address,address,uint256,uint256,uint256,uint256,uint256)
  "0xe6497e3ee548a3372136af2fcb0696db31fc6cf20260707645068bd3fe97f3c4": decodeTransferEvent

}

async function getPastEvents(web3, fromBlock, toBlock) {
  const events = await getRawEvents(web3, fromBlock, toBlock);

  const decodedEvents = await decodeEvents(web3, events, decodeFunctions)

  return decodedEvents
}


async function getRawEvents(web3, fromBlock, toBlock) {
  let queryObject = {
    fromBlock: web3.utils.numberToHex(fromBlock),
    toBlock: web3.utils.numberToHex(toBlock),
    address: MATIC_ADDRESS
  }

  return await web3.eth.getPastLogs(queryObject);
}


module.exports = {
  getPastEvents
}
