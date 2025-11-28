'use strict';

import { decodeAddress } from './util';
import { addCustomTokenDistribution } from './custom_token_distribution';
import { logger } from '../../../lib/logger';
import { Web3Static, Web3Interface } from '../../eth/lib/web3_wrapper';
import { TimestampsCacheInterface } from './timestamps_cache';
import { ERC20Transfer } from '../erc20_types';

type RawEvent = {
  address: string;
  data: string;
  topics: string[];
  blockNumber: number | string;
  transactionHash?: string;
  logIndex?: number | string;
  transactionIndex?: number | string;
  [key: string]: any;
};


export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const MINT_ADDRESS = 'mint';
const BURN_ADDRESS = 'burn';
const FREEZE_ADDRESS = 'freeze';
const BNB_contract = '0xb8c77482e45f1f44de1745f52c74426c631bdd52';
const QNT_contract = '0x4a220e6096b25eadb88358cb44068a3248254675';
const WETH_contract = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const ZERO_HEX_REGEX = /^0x0*$/i;

function parseHexToBigInt(hexValue: string): bigint {
  if (ZERO_HEX_REGEX.test(hexValue)) {
    return 0n;
  }
  return BigInt(hexValue);
}


export function decodeEventBasicInfo(event: RawEvent, timestampsCache: TimestampsCacheInterface, addContract = true): ERC20Transfer {
  const blockNumber = Number(event['blockNumber']);
  const timestamp = timestampsCache.getBlockTimestamp(blockNumber);

  const decodedEvent: any = {
    blockNumber,
    timestamp: timestamp,
    transactionHash: event['transactionHash'],
    logIndex: Number(event['logIndex']),
    transactionIndex: Number(event['transactionIndex'] ?? -1)
  };

  if (addContract) {
    decodedEvent.contract = event['address'].toLowerCase();
  }

  return decodedEvent;
}

/**Transfer(address,address,uint256)
 * Used by all ERC20 tokens
 **/
function decodeTransferEvent(event: RawEvent, timestampsCache: TimestampsCacheInterface): ERC20Transfer | null {
  const topics = event.topics;
  if (topics.length !== 3) {
    return null;
  }

  const result = decodeEventBasicInfo(event, timestampsCache);

  // Custom burn event for QNT token
  const to = decodeAddress(topics[2]);
  if (to.toLowerCase() === QNT_contract && event['address'].toLowerCase() === QNT_contract) {
    result.to = BURN_ADDRESS;
  } else {
    result.to = to;
  }

  result.from = decodeAddress(topics[1]);
  const value = parseHexToBigInt(event['data']);
  result.value = value;
  result.valueExactBase36 = value.toString(36);

  return result;
}

/**Burn(address,uint256)
 * We assume only the case where the address is indexed and the value is not
 **/
function decodeBurnEvent(event: RawEvent, timestampsCache: TimestampsCacheInterface): ERC20Transfer | null {
  const topics = event.topics;
  if (topics.length !== 2) {
    return null;
  }

  const result = decodeEventBasicInfo(event, timestampsCache);

  result.from = decodeAddress(topics[1]);
  result.to = BURN_ADDRESS;
  const value = parseHexToBigInt(event['data']);
  result.value = value;
  result.valueExactBase36 = value.toString(36);

  return result;
}

/**Mint(address,uint256)
 * We assume only the case where the address is indexed and the value is not
 **/
function decodeMintEvent(event: RawEvent, timestampsCache: TimestampsCacheInterface): ERC20Transfer | null {
  const topics = event.topics;
  if (topics.length !== 2) {
    return null;
  }

  const result = decodeEventBasicInfo(event, timestampsCache);

  result.from = MINT_ADDRESS;
  result.to = decodeAddress(topics[1]);
  const value = parseHexToBigInt(event['data']);
  result.value = value;
  result.valueExactBase36 = value.toString(36);

  return result;
}

/**Freeze(address indexed,uint256)
 * Only for BNB
 **/
function decodeBNBFreezeEvent(event: RawEvent, timestampsCache: TimestampsCacheInterface): ERC20Transfer | null {
  if (event['address'].toLowerCase() !== BNB_contract
    || event.topics.length !== 2) {
    return null;
  }

  const result = decodeEventBasicInfo(event, timestampsCache);

  result.from = decodeAddress(event.topics[1]);
  result.to = FREEZE_ADDRESS;
  const value = parseHexToBigInt(event['data']);
  result.value = value;
  result.valueExactBase36 = value.toString(36);

  return result;
}

/**Unfreeze(address indexed,uint256)
 * Only for BNB
 **/
function decodeBNBUnfreezeEvent(event: RawEvent, timestampsCache: TimestampsCacheInterface): ERC20Transfer | null {
  if (event['address'].toLowerCase() !== BNB_contract
    || event.topics.length !== 2) {
    return null;
  }

  const result = decodeEventBasicInfo(event, timestampsCache);

  result.from = FREEZE_ADDRESS;
  result.to = decodeAddress(event.topics[1]);
  const value = parseHexToBigInt(event['data']);
  result.value = value;
  result.valueExactBase36 = value.toString(36);

  return result;
}

/**Deposit(address indexed dst, uint wad)
 * Only for WETH
 **/
function decodeWETHDepositEvent(event: RawEvent, timestampsCache: TimestampsCacheInterface): ERC20Transfer | null {
  if (event['address'].toLowerCase() !== WETH_contract
    || event.topics.length !== 2) {
    return null;
  }

  const result = decodeEventBasicInfo(event, timestampsCache);

  result.from = MINT_ADDRESS;
  result.to = decodeAddress(event.topics[1]);
  const value = parseHexToBigInt(event['data']);
  result.value = value;
  result.valueExactBase36 = value.toString(36);

  return result;
}

/**Withdrawal(address,uint256)
 * Only for WETH
 **/
function decodeWETHWithdrawalEvent(event: RawEvent, timestampsCache: TimestampsCacheInterface): ERC20Transfer | null {
  if (event['address'].toLowerCase() !== WETH_contract
    || event.topics.length !== 2) {
    return null;
  }

  const result = decodeEventBasicInfo(event, timestampsCache);

  result.from = decodeAddress(event.topics[1]);
  result.to = BURN_ADDRESS;
  const value = parseHexToBigInt(event['data']);
  result.value = value;
  result.valueExactBase36 = value.toString(36);

  return result;
}

// hashes generated with https://emn178.github.io/online-tools/keccak_256.html
type DecodeEventFunction = (event: RawEvent, timestampsCache: TimestampsCacheInterface) => ERC20Transfer | null;

const decodeFunctionsMap: Record<string, DecodeEventFunction> = {
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef': decodeTransferEvent, //Transfer(address,address,uint256)
  '0xcc16f5dbb4873280815c1ee09dbd06736cffcc184412cf7a71a0fdb75d397ca5': decodeBurnEvent, //Burn(address,uint256)
  '0x0f6798a560793a54c3bcfe86a93cde1e73087d944c0ea20544137d4121396885': decodeMintEvent, //Mint(address,uint256)
  '0xf97a274face0b5517365ad396b1fdba6f68bd3135ef603e44272adba3af5a1e0': decodeBNBFreezeEvent, //Freeze(address,uint256)
  '0x2cfce4af01bcb9d6cf6c84ee1b7c491100b8695368264146a94d71e10a63083f': decodeBNBUnfreezeEvent, //Unfreeze(address,uint256)
  '0xb33527d2e0d30b7aece2c5e82927985866c1b75173d671c14f4457bf67aa6910': decodeMintEvent, //CreateBAT(address,uint256)
  '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c': decodeWETHDepositEvent,  //Deposit(address,uint256)
  '0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65': decodeWETHWithdrawalEvent //Withdrawal(address,uint256)
};


export async function getPastEvents(web3Wrapper: Web3Interface, fromBlock: number, toBlock: number,
  contractAddress: string | string[] | null, timestampsCache: TimestampsCacheInterface): Promise<ERC20Transfer[]> {
  const events = await getRawEvents(web3Wrapper, fromBlock, toBlock, contractAddress);
  const startTime = Date.now();
  const resolvedNow = await timestampsCache.waitResponse();
  if (resolvedNow) {
    logger.debug(`Block timestamps resolved in ${Date.now() - startTime} msecs`);
  }
  const decodedEvents = decodeEvents(events, timestampsCache);
  const result = filterEvents(decodedEvents);

  addCustomTokenDistribution(result, fromBlock, toBlock, contractAddress);

  return result;
}


async function getRawEvents(web3Wrapper: Web3Interface, fromBlock: number, toBlock: number, contractAddress: string | string[] | null): Promise<RawEvent[]> {
  let queryObject: any = {
    fromBlock: Web3Static.parseNumberToHex(fromBlock),
    toBlock: Web3Static.parseNumberToHex(toBlock),/*,
    // Parity has a bug when filtering topics: https://github.com/paritytech/parity-ethereum/issues/9629
    // TODO: Revert it when they fix it
    topics: decodeFunctions.keys()*/
  };

  if (contractAddress) {
    queryObject.address = contractAddress;
  }

  return await web3Wrapper.getPastLogs(queryObject);
}

export function decodeEvents(events: RawEvent[], timestampsCache: TimestampsCacheInterface, decodeFunctions: Record<string, DecodeEventFunction> = decodeFunctionsMap): ERC20Transfer[] {
  const result: ERC20Transfer[] = [];
  for (const event of events) {
    if (event.topics && event.topics[0]) {
      const decodeFunction = decodeFunctions[event.topics[0]];
      if (decodeFunction) {
        const decodedEvent: ERC20Transfer | null = decodeFunction(event, timestampsCache);
        if (decodedEvent) result.push(decodedEvent);
      }
    }
  }

  return result;
}

function filterEvents(events: ERC20Transfer[]): ERC20Transfer[] {
  const result: ERC20Transfer[] = [];
  const eventsByTransactionIter = getEventsByTransaction(events);
  for (let curTransactionEvents of eventsByTransactionIter) {
    let curResult = filterTransactionEvents(curTransactionEvents);
    curResult.forEach((x) => result.push(x));
  }

  return result;
}

// returns an array of arrays - all events in one transaction are grouped together
// assumes that all events in one transaction are next to one another in the log
function* getEventsByTransaction(events: ERC20Transfer[]): Generator<ERC20Transfer[], void, unknown> {
  if (events.length === 0) {
    return;
  }
  let curTransactionHash = events[0].transactionHash;
  let curTransactionEvents: ERC20Transfer[] = [];
  for (let i = 0; i < events.length; i++) {
    let event = events[i];
    if (event.transactionHash) {
      if (event.transactionHash !== curTransactionHash) {
        if (curTransactionEvents.length > 0) {
          yield curTransactionEvents;

          curTransactionHash = event.transactionHash;
          curTransactionEvents = [];
        }
      }

      curTransactionEvents.push(event);
    }
  }

  if (curTransactionEvents.length > 0) {
    yield curTransactionEvents;
  }
}

// Within a transaction removes the transfer events from/to the zero address that match a corresponding mint/burn event
function filterTransactionEvents(eventsInTransaction: ERC20Transfer[]): ERC20Transfer[] {
  const mintEvents: ERC20Transfer[] = [];
  const burnEvents: ERC20Transfer[] = [];
  eventsInTransaction.forEach((event) => {
    if (event.from === MINT_ADDRESS) {
      mintEvents.push(event);
    }
    else if (event.to === BURN_ADDRESS) {
      burnEvents.push(event);
    }
  });

  const result: ERC20Transfer[] = [];
  eventsInTransaction.forEach((event) => {
    if (event.from === ZERO_ADDRESS) {
      const exists = mintEvents.some((mintEvent) =>
        mintEvent.contract === event.contract
        && mintEvent.to === event.to
        && mintEvent.valueExactBase36 === event.valueExactBase36);
      if (!exists) {
        result.push(event);
      }
    }
    else if (event.to === ZERO_ADDRESS) {
      const exists = burnEvents.some((burnEvent) =>
        burnEvent.contract === event.contract
        && burnEvent.from === event.from
        && burnEvent.valueExactBase36 === event.valueExactBase36);
      if (!exists) {
        result.push(event);
      }
    }
    else {
      result.push(event);
    }
  });

  return result;
}
