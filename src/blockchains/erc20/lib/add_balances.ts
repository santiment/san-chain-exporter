import { assertIsDefinedLazy } from '../../../lib/utils';
import { ERC20Transfer } from '../erc20_types';
import { Web3 } from 'web3';
import { MULTICALL_ABI, ERC20_ABI, MULTICALL_ADDRESS } from './abis';
import * as Utils from './balance_utils';
import { logger } from '../../../lib/logger';


type BlockNumberToBalances = Map<number, Utils.AddressContractToBalance>;
type BlockNumberToAffectedAddresses = Map<number, Utils.AddressContractStore>;

export const MULTICALL_FAILURE = "multicall_failure"

async function doMulticall(web3: Web3, blockNumber: number, addressContract: Utils.AddressContract[]): Promise<any[]> {
  const multicall = new web3.eth.Contract(MULTICALL_ABI, MULTICALL_ADDRESS);

  const calls = addressContract.map(([address, contractAddress]) => {
    const contract = new web3.eth.Contract(ERC20_ABI, contractAddress);
    const data = contract.methods.balanceOf(address).encodeABI();
    return {
      target: contractAddress,
      callData: data
    };
  });

  return await multicall.methods.tryAggregate(false, calls).call({}, blockNumber);
}



function decodeMulticallResult(addressContractToMulticallResult: Utils.AddressContractToMulticallResult, web3: Web3,
  blockNumber: number): Utils.BlockNumberAddressContractBalance {

  const addressContract = addressContractToMulticallResult[0]
  const multicallResult = addressContractToMulticallResult[1]

  if (multicallResult[0]) {
    try {
      const decoded: bigint = web3.eth.abi.decodeParameter('uint256', multicallResult[1]) as bigint
      return [blockNumber, addressContract[0], addressContract[1], decoded.toString(36)];
    }
    catch (error: any) {
      logger.warn(`Error decoding address-contract: ${addressContract[0]}-${addressContract[1]}: ${error}`)

    }
  }

  logger.warn(`Multicall partial failure for address-contract ${addressContract[0]}-${addressContract[1]}`)
  return [blockNumber, addressContract[0], addressContract[1], MULTICALL_FAILURE]
}

async function executeNonBatchMulticall(web3: Web3, addressContracts: Utils.AddressContract[], blockNumber: number)
  : Promise<Utils.AddressContractToMulticallResult[]> {
  const allSettled = await Promise.allSettled(addressContracts.flatMap(addressContract =>
    doMulticall(web3, blockNumber, [addressContract])
  ))

  if (allSettled.length !== addressContracts.length) {
    throw new Error(`Multicall response size does not match at block ${blockNumber}`);
  }

  const errors = allSettled.filter(result => result.status === 'rejected').map(result => result.reason);

  /**
   * We allow for failed requests at this point. Some responses are just too long and seem like errors. Ex:
   *
   * curl -X POST https://ethereum.santiment.net -H "Content-Type: application/json" -d '{
   * "jsonrpc": "2.0", "id": "1", "method": "eth_call", "params": [
   *   {
   *     "to": "0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696",
   *     "data": "0xbce38bd70000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000e2975f6a95735bdcad5e39296d37cab6470dacc80000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000002470a082310000000000000000000000007ac9368773c8d985c785ddda1964fa7c082cf89b00000000000000000000000000000000000000000000000000000000"
   *   },
   *     "0xd70c5d"
   *   ]
   *   }'
   *
   * This fails on our endpoint but succeeds on Ankr due to different limits. However the response is a long sequence
   * of 0s.
   */
  if (errors.length > 0) {
    logger.warn(`${errors.length} errors out of ${addressContracts.length} in multicall at block ${blockNumber}. First errors is: ${errors[0]}`);
  }

  return addressContracts.map((addressContract, index) => {
    const multicallResult = allSettled[index]

    if (multicallResult.status === 'fulfilled') {
      if (Array.isArray(multicallResult.value) && multicallResult.value.length === 1) {
        return [addressContract, multicallResult.value[0]]
      }
      else {
        throw Error(`Non batch Multicall does not expected response structure: ${JSON.stringify(multicallResult.value)}`)
      }
    }
    else {
      return [addressContract, MULTICALL_FAILURE]
    }
  })
}

async function executeBatchMulticall(web3: Web3, addressContracts: Utils.AddressContract[], blockNumber: number)
  : Promise<Utils.AddressContractToMulticallResult[]> {
  const multicallResult = await doMulticall(web3, blockNumber, addressContracts)
  if (multicallResult.length !== addressContracts.length) {
    throw new Error(`Multicall response size does not match at block ${blockNumber}`);
  }

  return addressContracts.map((addressContract, index) => [addressContract, multicallResult[index]]);
}

async function getBalancesPerBlock(web3: Web3, addressContracts: Utils.AddressContract[], blockNumber: number)
  : Promise<Utils.BlockNumberAddressContractBalance[]> {

  let rawMulticallResult: Utils.AddressContractToMulticallResult[] = []
  try {
    rawMulticallResult = await executeBatchMulticall(web3, addressContracts, blockNumber)
  }
  catch (error: any) {
    logger.warn(`Error calling multicall at block ${blockNumber}, would try without batching`)
  }

  if (rawMulticallResult.length === 0) {
    rawMulticallResult = await executeNonBatchMulticall(web3, addressContracts, blockNumber)
    return rawMulticallResult.map((rawResult: Utils.AddressContractToMulticallResult) => {
      if (rawResult[1] === MULTICALL_FAILURE) {
        // The balance call for this address-contract pair has failed. We would mark it as failure without decoding
        return [blockNumber, rawResult[0][0], rawResult[0][1], MULTICALL_FAILURE]
      }
      else {
        return decodeMulticallResult(rawResult, web3, blockNumber)
      }
    })
  }
  else {
    return rawMulticallResult.map(rawResult => decodeMulticallResult(rawResult, web3, blockNumber))
  }
}

//Get all addresses invovled in transfers. Map them to the block where the transfer happened.
function identifyAddresses(events: ERC20Transfer[]): BlockNumberToAffectedAddresses {
  return events.reduce((acc, event) => {
    const blockNumberSet = acc.get(event.blockNumber)
    if (blockNumberSet) {
      Utils.addToSet(blockNumberSet, event);
    }
    else {
      const newSet = new Utils.AddressContractStore();
      Utils.addToSet(newSet, event);
      acc.set(event.blockNumber, newSet)
    }
    return acc;
  }, new Map() as BlockNumberToAffectedAddresses)

}

// Build a balance map for all addresses involved in transactions
async function buildBalancesMap(web3: Web3, batchedAddresses: [number, Utils.AddressContract[]][]): Promise<BlockNumberToBalances> {
  const results: Utils.BlockNumberAddressContractBalance[] = []
  for (const blockNumberAddress of batchedAddresses) {
    let result: Utils.BlockNumberAddressContractBalance[] = [];
    result = await getBalancesPerBlock(web3, blockNumberAddress[1], blockNumberAddress[0])
    results.push(...result)
  }

  return results.reduce((acc, result) => {
    const blockNumber = result[0];
    const balances = acc.get(blockNumber)
    if (balances) {
      Utils.addToMap(balances, result);
    }
    else {
      const newMap: Utils.AddressContractToBalance = new Map();
      Utils.addToMap(newMap, result);
      acc.set(blockNumber, newMap)
    }
    return acc;
  }, new Map() as BlockNumberToBalances)
}

export async function extendTransfersWithBalances(web3: Web3, events: ERC20Transfer[], multicallBatchSize: number) {
  const addressesInvolved: BlockNumberToAffectedAddresses = identifyAddresses(events);

  const batchedAddresses: [number, Utils.AddressContract[]][] = [];

  // Break the needed balances into batches. Not sure what the Multicall limit is but we most probably do not want
  // to ask for all at once.
  for (const [blockNumber, addressSet] of Array.from(addressesInvolved.entries())) {
    const brokenPerBatchAddresses: Utils.AddressContract[][] = Utils.breakNeededBalancesPerBatch(addressSet.values(),
      multicallBatchSize)
    brokenPerBatchAddresses.map((addressContract: Utils.AddressContract[]) => {
      batchedAddresses.push([blockNumber, addressContract])
    })
  }

  const balanceMap = await buildBalancesMap(web3, batchedAddresses);
  for (const event of events) {
    if (Utils.isAddressEligableForBalance(event.from, event.contract)) {
      event.fromBalance = balanceMap.get(event.blockNumber)?.get(Utils.concatAddressAndContract(event.from, event.contract))
      assertIsDefinedLazy(event.fromBalance, () => `'from' balance should have been resovled for event ${JSON.stringify(event)}`)
    }

    if (Utils.isAddressEligableForBalance(event.to, event.contract)) {
      event.toBalance = balanceMap.get(event.blockNumber)?.get(Utils.concatAddressAndContract(event.to, event.contract))
      assertIsDefinedLazy(event.toBalance, () => `'to' balance should have been resovled for event ${JSON.stringify(event)}`)
    }
  }
}



