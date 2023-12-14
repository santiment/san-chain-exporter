'use strict';
const { decodeEvents } = require('../../erc20/lib/fetch_events');
const { TimestampsCache } = require('../../erc20/lib/timestamps_cache');
const { decodeAddress } = require('../../erc20/lib/util');
const { decodeEventBasicInfo } = require('../../erc20/lib/fetch_events');

const MATIC_ADDRESS = '0x0000000000000000000000000000000000001010';


/**Transfer(address,address,uint256)
 * Used by all Polygon ERC20 tokens
 **/
async function decodeTransferEvent(web3Wrapper, event, timestampsCache) {
  if (event['topics'].length !== 4) {
    return null;
  }

  const result = await decodeEventBasicInfo(event, timestampsCache, false);

  result.from = decodeAddress(event['topics'][2]);
  result.to = decodeAddress(event['topics'][3]);
  result.value = Number(web3Wrapper.parseHexToNumber(event['data'].substring(0, 66)));
  result.valueExactBase36 = web3Wrapper.parseHexToBase36String(event['data'].substring(0, 66));

  return result;
}

// hashes generated with https://emn178.github.io/online-tools/keccak_256.html
const decodeFunctions = {
  // LogTransfer(address,address,address,uint256,uint256,uint256,uint256,uint256)
  '0xe6497e3ee548a3372136af2fcb0696db31fc6cf20260707645068bd3fe97f3c4': decodeTransferEvent

};

async function getPastEvents(web3Wrapper, fromBlock, toBlock) {
  const events = await getRawEvents(web3Wrapper, fromBlock, toBlock);

  const decodedEvents = await decodeEvents(web3Wrapper, events, new TimestampsCache(), decodeFunctions);

  return decodedEvents;
}


async function getRawEvents(web3Wrapper, fromBlock, toBlock) {
  let queryObject = {
    fromBlock: web3Wrapper.parseNumberToHex(fromBlock),
    toBlock: web3Wrapper.parseNumberToHex(toBlock),
    address: MATIC_ADDRESS
  };

  return await web3Wrapper.getPastLogs(queryObject);
}


module.exports = {
  getPastEvents
};
