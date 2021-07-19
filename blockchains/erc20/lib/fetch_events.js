"use strict";

const { decodeAddress } = require('./util')
const { addCustomTokenDistribution } = require('./custom_token_distribution')

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const MINT_ADDRESS = "mint"
const BURN_ADDRESS = "burn"
const FREEZE_ADDRESS = "freeze"
const BNB_contract = "0xb8c77482e45f1f44de1745f52c74426c631bdd52"
const QNT_contract = "0x4a220e6096b25eadb88358cb44068a3248254675"
const WETH_contract = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"


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

  // Custom burn event for QNT token
  let to = decodeAddress(event["topics"][2])
  if (to.toLowerCase() == QNT_contract && event["address"].toLowerCase() == QNT_contract) {
    result.to = BURN_ADDRESS;
  } else {
    result.to = to;
  }

  result.from = decodeAddress(event["topics"][1])
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
  if (event["address"].toLowerCase() != BNB_contract
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
  if (event["address"].toLowerCase() != BNB_contract
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

/**Deposit(address indexed dst, uint wad)
 * Only for WETH
 **/
async function decodeWETHDepositEvent(web3, event, blockTimestamps) {
  if (event["address"].toLowerCase() != WETH_contract
      || event["topics"].length != 2) {
    return null
  }

  let result = await decodeEventBasicInfo(web3, event, blockTimestamps)

  result.from = MINT_ADDRESS
  result.to = decodeAddress(event["topics"][1])
  result.value = parseFloat(web3.utils.hexToNumberString(event["data"]))
  result.valueExactBase36 = web3.utils.toBN(event["data"]).toString(36)

  return result
}

/**Withdrawal(address,uint256)
 * Only for WETH
 **/
async function decodeWETHWithdrawalEvent(web3, event, blockTimestamps) {
  if (event["address"].toLowerCase() != WETH_contract
      || event["topics"].length != 2) {
    return null
  }

  let result = await decodeEventBasicInfo(web3, event, blockTimestamps)

  result.from = decodeAddress(event["topics"][1])
  result.to = BURN_ADDRESS
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
  "0xb33527d2e0d30b7aece2c5e82927985866c1b75173d671c14f4457bf67aa6910": decodeMintEvent, //CreateBAT(address,uint256)
  "0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c": decodeWETHDepositEvent,  //Deposit(address,uint256)
  "0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65": decodeWETHWithdrawalEvent //Withdrawal(address,uint256)
}



async function getPastEvents(web3, fromBlock, toBlock, contractAddress) {
  const events = await getRawEvents(web3, fromBlock, toBlock, contractAddress);

  const decodedEvents = await decodeEvents(web3, events)
  const result = filterEvents(decodedEvents)

  addCustomTokenDistribution(result, fromBlock, toBlock, contractAddress)

  return result
}


async function getRawEvents(web3, fromBlock, toBlock, contractAddress) {
  let queryObject = {
    fromBlock: web3.utils.numberToHex(fromBlock),
    toBlock: web3.utils.numberToHex(toBlock),/*,
    // Parity has a bug when filtering topics: https://github.com/paritytech/parity-ethereum/issues/9629
    // TODO: Revert it when they fix it
    topics: decodeFunctions.keys()*/
  }

  if (contractAddress) {
    queryObject.address = contractAddress;
  }

  return await web3.eth.getPastLogs(queryObject);
}

async function decodeEvents(web3, events) {
  const blockTimestamps = {}
  const result = []
  for (let i = 0; i < events.length; i++) {
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

function filterEvents(events) {
  const result = []
  const eventsByTransactionIter = getEventsByTransaction(events)
  for(let curTransactionEvents of eventsByTransactionIter) {
    let curResult = filterTransactionEvents(curTransactionEvents)
    curResult.forEach((x) => result.push(x))
  }

  return result
}

// returns an array of arrays - all events in one transaction are grouped together
// assumes that all events in one transaction are next to one another in the log
function* getEventsByTransaction(events) {
  if (0 == events.length) {
    return
  }
  let curTransactionHash = events[0].transactionHash
  let curTransactionEvents = []
  for (let i = 0;i < events.length; i++) {
    let event = events[i]
    if(event.transactionHash) {
      if(event.transactionHash != curTransactionHash) {
        if(curTransactionEvents.length > 0) {
          yield curTransactionEvents

          curTransactionHash = event.transactionHash
          curTransactionEvents = []
        }
      }

      curTransactionEvents.push(event)
    }
  }

  if(curTransactionEvents.length > 0) {
    yield curTransactionEvents
  }
}

// Within a transaction removes the transfer events from/to the zero address that match a corresponding mint/burn event
function filterTransactionEvents(eventsInTransaction) {
  const mintEvents = []
  const burnEvents = []
  eventsInTransaction.forEach((event) => {
    if(event.from == MINT_ADDRESS) {
      mintEvents.push(event)
    }
    else if(event.to == BURN_ADDRESS) {
      burnEvents.push(event)
    }
  })

  const result = []
  eventsInTransaction.forEach((event) => {
    if(event.from == ZERO_ADDRESS) {
      const exists = mintEvents.some((mintEvent) =>
        mintEvent.contract == event.contract
        && mintEvent.to == event.to
        && mintEvent.valueExactBase36 == event.valueExactBase36)
      if(!exists) {
        result.push(event)
      }
    }
    else if(event.to == ZERO_ADDRESS) {
      const exists = burnEvents.some((burnEvent) =>
        burnEvent.contract == event.contract
        && burnEvent.from == event.from
        && burnEvent.valueExactBase36 == event.valueExactBase36)
      if(!exists) {
        result.push(event)
      }
    }
    else {
      result.push(event)
    }
  })

  return result
}


module.exports = {
  getPastEvents
}
