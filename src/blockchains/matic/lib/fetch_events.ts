'use strict';
import { decodeEvents } from '../../erc20/lib/fetch_events';
import { TimestampsCache, TimestampsCacheInterface } from '../../erc20/lib/timestamps_cache';
import { decodeAddress } from '../../erc20/lib/util';
import { decodeEventBasicInfo } from '../../erc20/lib/fetch_events';
import { Web3Interface } from '../../eth/lib/web3_wrapper';
import { HTTPClientInterface } from '../../../types'
import { ERC20Transfer } from '../../erc20/erc20_types';

const MATIC_ADDRESS = '0x0000000000000000000000000000000000001010';


/**Transfer(address,address,uint256)
 * Used by all Polygon ERC20 tokens
 **/
function decodeTransferEvent(web3Wrapper: Web3Interface, event: any, timestampsCache: TimestampsCacheInterface) {
  if (event['topics'].length !== 4) {
    return null;
  }

  const result = decodeEventBasicInfo(event, timestampsCache, false);

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

export async function getPastEvents(ethClient: HTTPClientInterface, web3Wrapper: Web3Interface, fromBlock: number, toBlock: number): Promise<ERC20Transfer[]> {
  const events = await getRawEvents(web3Wrapper, fromBlock, toBlock);

  const timestampsCache = new TimestampsCache(ethClient, web3Wrapper, fromBlock, toBlock);
  await timestampsCache.waitResponse();
  return decodeEvents(web3Wrapper, events, timestampsCache, decodeFunctions);
}


async function getRawEvents(web3Wrapper: Web3Interface, fromBlock: number, toBlock: number) {
  let queryObject = {
    fromBlock: web3Wrapper.parseNumberToHex(fromBlock),
    toBlock: web3Wrapper.parseNumberToHex(toBlock),
    address: MATIC_ADDRESS
  };

  return await web3Wrapper.getPastLogs(queryObject);
}

