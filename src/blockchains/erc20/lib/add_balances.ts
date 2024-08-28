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



function decodeMulticallResult(multicallResults: any[], web3: Web3, blockNumber: number,
  addressContract: Utils.AddressContract[]): Utils.BlockNumberAddressContractBalance[] {
  const result: Utils.BlockNumberAddressContractBalance[] = [];

  let index = 0;
  addressContract.forEach(([address, contractAddress]) => {
    const multicallResult = multicallResults[index];

    let decodeSuccess = false;
    if (multicallResult[0]) {
      try {
        const decoded: bigint = web3.eth.abi.decodeParameter('uint256', multicallResult[1]) as bigint
        result.push([blockNumber, address, contractAddress, decoded.toString(36)]);
        decodeSuccess = true;
      }
      catch (error: any) {
        logger.error(`Error decoding address-contract: ${address}-${contractAddress}: ${error}`)
      }
    }

    if (!decodeSuccess) {
      logger.error(`Multicall partial failure for address-contract ${address}-${contractAddress}`)
      result.push([blockNumber, address, contractAddress, MULTICALL_FAILURE])
    }
    index++;
  });
  return result;
}

async function getBalancesPerBlock(web3: Web3, addressContracts: Utils.AddressContract[], blockNumber: number)
  : Promise<Utils.BlockNumberAddressContractBalance[]> {

  let multicallResult: any[] = []
  try {
    multicallResult = await doMulticall(web3, blockNumber, addressContracts)
  }
  catch (error: any) {
    logger.warn('Error calling multicall, would try not batching')
  }

  if (multicallResult.length === 0) {
    try {
      multicallResult = await Promise.all(addressContracts.flatMap(addressContract =>
        doMulticall(web3, blockNumber, [addressContract])
      ))
    }
    catch (error: any) {
      if (error.cause.data) {
        const decodedReason = Utils.decodeRevertReason(web3, error.cause.data);
        logger.error('Revert reason:', decodedReason);
      }
      throw error;
    }
  }

  if (multicallResult.length !== addressContracts.length) {
    throw new Error("Response size does not match");
  }

  return decodeMulticallResult(multicallResult, web3, blockNumber, addressContracts)
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



