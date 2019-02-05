/* jslint es6 */
"use strict";

const { decodeAddress, decodeLogParameters } = require('./util')

const MINT_ADDRESS = "mint"
const BURN_ADDRESS = "burn"
const FREEZE_ADDRESS = "freeze"

async function getBlockTimestamp(web3, blockNumber) {
  const block = await web3.eth.getBlock(blockNumber)

  return block["timestamp"]
}

async function decodeEventBasicInfo(web3, event, blockTimestamps) {
  let timestamp
  if (!blockTimestamps[event["blockNumber"]]) {
    timestamp = blockTimestamps[event["blockNumber"]] = await getBlockTimestamp(web3, event["blockNumber"])
  } else {
    timestamp = blockTimestamps[event["blockNumber"]]
  }

  return {
    contract: event["address"].toLowerCase(),
    blockNumber: parseInt(web3.utils.hexToNumberString(event["blockNumber"])),
    timestamp: timestamp,
    transactionHash: event["transactionHash"],
    logIndex: parseInt(web3.utils.hexToNumberString(event["logIndex"]))
  }
}

/**Transfer(address,address,uint256)
 * Used by all ERC20 tokens
 **/
async function decodeTransferEvent(web3, event, blockTimestamps) {
  if (event["topics"].length != 3) {
    return null
  }

  let result = await decodeEventBasicInfo(web3, event, blockTimestamps)
  
  result.from = decodeAddress(event["topics"][1])
  result.to = decodeAddress(event["topics"][2])
  result.value = parseFloat(web3.utils.hexToNumberString(event["data"]))
  result.valueExactBase36 = web3.utils.toBN(event["data"]).toString(36)

  return result
}

/**Burn(address,uint256)
 * We assume only the case where the address is indexed and the value is not
 **/
async function decodeBurnEvent(web3, event, blockTimestamps) {
  if (event["topics"].length != 2) {
    return null
  }

  let result = await decodeEventBasicInfo(web3, event, blockTimestamps)
  
  result.from = decodeAddress(event["topics"][1])
  result.to = BURN_ADDRESS
  result.value =  parseFloat(web3.utils.hexToNumberString(event["data"]))
  result.valueExactBase36 = web3.utils.toBN(event["data"]).toString(36)

  return result
}

/**Mint(address,uint256)
 * We assume only the case where the address is indexed and the value is not
 **/
async function decodeMintEvent(web3, event, blockTimestamps) {
  if (event["topics"].length != 2) {
    return null
  }

  let result = await decodeEventBasicInfo(web3, event, blockTimestamps)
  
  result.from = MINT_ADDRESS
  result.to = decodeAddress(event["topics"][1])
  result.value = parseFloat(web3.utils.hexToNumberString(event["data"]))
  result.valueExactBase36 = web3.utils.toBN(event["data"]).toString(36)

  return result
}

/**Freeze(address indexed,uint256)
 * Only for BNB
 **/
async function decodeBNBFreezeEvent(web3, event, blockTimestamps) {
  if (event["address"].toLowerCase() != "0xb8c77482e45f1f44de1745f52c74426c631bdd52"
      || event["topics"].length != 2) {
    return null
  }

  let result = await decodeEventBasicInfo(web3, event, blockTimestamps)
  
  result.from = decodeAddress(event["topics"][1])
  result.to = FREEZE_ADDRESS
  result.value = parseFloat(web3.utils.hexToNumberString(event["data"]))
  result.valueExactBase36 = web3.utils.toBN(event["data"]).toString(36)

  return result
}

/**Unfreeze(address indexed,uint256)
 * Only for BNB
 **/
async function decodeBNBUnfreezeEvent(web3, event, blockTimestamps) {
  if (event["address"].toLowerCase() != "0xb8c77482e45f1f44de1745f52c74426c631bdd52"
      || event["topics"].length != 2) {
    return null
  }

  let result = await decodeEventBasicInfo(web3, event, blockTimestamps)
  
  result.from = FREEZE_ADDRESS
  result.to = decodeAddress(event["topics"][1])
  result.value = parseFloat(web3.utils.hexToNumberString(event["data"]))
  result.valueExactBase36 = web3.utils.toBN(event["data"]).toString(36)

  return result
}

// hashes generated with https://emn178.github.io/online-tools/keccak_256.html
const decodeFunctions = {
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef": decodeTransferEvent, //Transfer(address,address,uint256)
  "0xcc16f5dbb4873280815c1ee09dbd06736cffcc184412cf7a71a0fdb75d397ca5": decodeBurnEvent, //Burn(address,uint256)
  "0x0f6798a560793a54c3bcfe86a93cde1e73087d944c0ea20544137d4121396885": decodeMintEvent, //Mint(address,uint256)
  "0xf97a274face0b5517365ad396b1fdba6f68bd3135ef603e44272adba3af5a1e0": decodeBNBFreezeEvent, //Freeze(address,uint256)
  "0x2cfce4af01bcb9d6cf6c84ee1b7c491100b8695368264146a94d71e10a63083f": decodeBNBUnfreezeEvent, //Unfreeze(address,uint256)
  "0xb33527d2e0d30b7aece2c5e82927985866c1b75173d671c14f4457bf67aa6910": decodeMintEvent //CreateBAT(address,uint256)
}

exports.getPastEvents = async function(web3, fromBlock, toBlock) {
  let events = await web3.eth.getPastLogs({
    fromBlock: web3.utils.numberToHex(fromBlock),
    toBlock: web3.utils.numberToHex(toBlock)/*,
    // Parity has a bug when filtering topics: https://github.com/paritytech/parity-ethereum/issues/9629
    // TODO: Revert it when they fix it
    topics: decodeFunctions.keys()*/
  })

  const blockTimestamps = {}
  const result = []
  for (let i = 0;i < events.length; i++) {
    let event = events[i]
    if(event.topics && event.topics[0]) {
      const decodeFunction = decodeFunctions[event.topics[0]]
      if(decodeFunction) {
        const decodedEvent = await decodeFunction(web3, event, blockTimestamps)
        if (decodedEvent) result.push(decodedEvent)
      }
    }
  }

  return result
}