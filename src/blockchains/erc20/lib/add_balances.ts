import { assertIsDefinedLazy } from '../../../lib/utils';
import { ERC20Transfer } from '../erc20_types';
import { Web3 } from 'web3';
import { MULTICALL_ABI, ERC20_ABI, MULTICALL_ADDRESS } from './abis';
import * as Utils from './balance_utils';


type BlockNumberToBalances = Map<number, Utils.AddressContractToBalance>;
type BlockNumberToAffectedAddresses = Map<number, Utils.ValueSet>;

const MULTICALL_FAILURE = "multicall_failure"

async function getBalancesPerBlock(web3: Web3, addressContract: Utils.AddressContract[], blockNumber: number)
  : Promise<Utils.BlockNumberAddressContractBalance[]> {
  const multicall = new web3.eth.Contract(MULTICALL_ABI, MULTICALL_ADDRESS);

  const calls = addressContract.map(([address, contractAddress]) => {
    const contract = new web3.eth.Contract(ERC20_ABI, contractAddress);
    const data = contract.methods.balanceOf(address).encodeABI();
    //console.log(`Asking balance ${blockNumber}-${address}-${contractAddress}`)
    return {
      target: contractAddress,
      callData: data
    };
  });

  let resultsMulticall: any[]
  try {
    resultsMulticall = await multicall.methods.tryAggregate(false, calls).call({}, blockNumber);
  }
  catch (error: any) {
    console.error('Error while calling multicall:', error);

    if (error.cause.data) {
      const decodedReason = Utils.decodeRevertReason(web3, error.cause.data);
      console.error('Revert reason:', decodedReason);
    }
    throw error;
  }

  if (resultsMulticall.length !== addressContract.length) {
    throw new Error("Response size does not match");
  }

  let index = 0;

  const result: Utils.BlockNumberAddressContractBalance[] = [];
  addressContract.forEach(([address, contractAddress]) => {
    const resultMulticall = resultsMulticall[index];

    if (resultMulticall[0]) {
      const decoded: bigint = web3.eth.abi.decodeParameter('uint256', resultMulticall[1]) as bigint
      result.push([blockNumber, address, contractAddress, decoded.toString(36)])
    }
    else {
      console.error("Multicall partial failure")
      result.push([blockNumber, address, contractAddress, MULTICALL_FAILURE])
    }
    index++;
  });
  return result;
}


export async function extendTransfersWithBalances(web3: Web3, events: ERC20Transfer[]) {
  // Identify for which addresses we need to fetch balances
  const neededBalances: BlockNumberToAffectedAddresses = events.reduce((acc, event) => {
    const blockNumberSet = acc.get(event.blockNumber)
    if (blockNumberSet) {
      Utils.addToSet(blockNumberSet, event);
    }
    else {
      const newSet = new Utils.ValueSet();
      Utils.addToSet(newSet, event);
      acc.set(event.blockNumber, newSet)
    }
    return acc;
  }, new Map() as BlockNumberToAffectedAddresses)


  const addresses: [number, Utils.AddressContract[]][] = [];

  for (const [blockNumber, addressSet] of Array.from(neededBalances.entries())) {
    const brokenPerBatchAddresses: Utils.AddressContract[][] = Utils.breakNeededBalancesPerBatch(addressSet.values())
    brokenPerBatchAddresses.map((addressContract: Utils.AddressContract[]) => {
      addresses.push([blockNumber, addressContract])
    })
  }

  const results: Utils.BlockNumberAddressContractBalance[] = []
  for (const blockNumberAddress of addresses) {
    let result: Utils.BlockNumberAddressContractBalance[] = [];
    try {
      result = await getBalancesPerBlock(web3, blockNumberAddress[1], blockNumberAddress[0])
    }
    catch (error: any) {
      console.error(`No balance for ${result}`)
    }
    //console.log("Got balance: ", result)
    results.push(...result)
  }


  //const results: AddressContractBalance[][] = await Promise.all(promises);

  // Store the discovered balances in a Map structure for easy access
  let index = 0;

  const balanceMap = results.reduce((acc, result) => {
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
    ++index;
    return acc;
  }, new Map() as BlockNumberToBalances)

  // Array.from(balanceMap.get(19000171)!.entries()).forEach(pair => {
  //   console.log(`${pair[0]} --> ${pair[1]}`)
  // })


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



