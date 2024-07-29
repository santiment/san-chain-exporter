import { assertIsDefinedLazy } from '../../../lib/utils';
import { ERC20Transfer } from '../erc20_types';
import { Web3 } from 'web3';
import { ZERO_ADDRESS } from './fetch_events';

type AddressContractToBalance = Map<string, string>;
type BlockNumberToBalances = Map<number, AddressContractToBalance>;
type AddressContract = [string, string]
type BlockNumberAddressContractBalance = [number, string, string, string]
type BlockNumberToAffectedAddresses = Map<number, ValueSet>;

const MAX_BALANCES_PER_QUERY = 50;
const MULTICALL_FAILURE = "multicall_failure"

const multicallAbi = [
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "bool",
        "name": "requireSuccess",
        "type": "bool"
      },
      {
        "components": [
          {
            "internalType": "address",
            "name": "target",
            "type": "address"
          },
          {
            "internalType": "bytes",
            "name": "callData",
            "type": "bytes"
          }
        ],
        "internalType": "struct Multicall3.Call[]",
        "name": "calls",
        "type": "tuple[]"
      }
    ],
    "name": "tryAggregate",
    "outputs": [
      {
        "components": [
          {
            "internalType": "bool",
            "name": "success",
            "type": "bool"
          },
          {
            "internalType": "bytes",
            "name": "returnData",
            "type": "bytes"
          }
        ],
        "internalType": "struct Multicall3.Result[]",
        "name": "returnData",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  }
];

const multicallAddress = '0xcA11bde05977b3631167028862bE2a173976CA11';

const ERC20_ABI = [
  {
    "constant": true,
    "inputs": [
      {
        "name": "_owner",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "name": "balance",
        "type": "uint256"
      }
    ],
    "type": "function"
  }
];

function decodeRevertReason(web3: Web3, errorData: string) {
  try {
    return web3.eth.abi.decodeParameter('string', '0x' + errorData.slice(10));
  } catch (e) {
    return 'Unable to decode error data';
  }
}

async function getBalancesPerBlock(web3: Web3, addressContract: AddressContract[], blockNumber: number)
  : Promise<BlockNumberAddressContractBalance[]> {
  const multicall = new web3.eth.Contract(multicallAbi, multicallAddress);

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
      const decodedReason = decodeRevertReason(web3, error.cause.data);
      console.error('Revert reason:', decodedReason);
    }
    throw error;
  }

  if (resultsMulticall.length !== addressContract.length) {
    throw new Error("Response size does not match");
  }

  let index = 0;

  const result: BlockNumberAddressContractBalance[] = [];
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

function addToSet(set: ValueSet, event: ERC20Transfer, web3: Web3) {

  if (isAddressEligableForBalance(web3, event.from, event.contract)) {
    set.add([event.from, event.contract]);
  }
  if (isAddressEligableForBalance(web3, event.to, event.contract)) {
    set.add([event.to, event.contract]);
  }
}

function concatAddressAndContract(address: string, contract: string): string {
  return address + "-" + contract
}

function addToMap(map: AddressContractToBalance, balance: BlockNumberAddressContractBalance) {
  //console.log(`Adding balance ${balance[0]}-${balance[1]}-${balance[2]}-${balance[3]}`)
  const concatenation = concatAddressAndContract(balance[1], balance[2])
  map.set(concatenation, balance[3])
}

function breakNeededBalancesPerBatch(input: AddressContract[]): AddressContract[][] {
  const result = [];
  for (let i = 0; i < input.length; i += MAX_BALANCES_PER_QUERY) {
    result.push(input.slice(i, i + MAX_BALANCES_PER_QUERY));
  }
  return result;
}

function isAddressEligableForBalance(web3: Web3, address: string, contract: string): boolean {
  // TODO migrate deprecation
  return web3.utils.isAddress(address) && address !== ZERO_ADDRESS && address !== contract
}

export async function extendTransfersWithBalances(web3: Web3, events: ERC20Transfer[]) {
  // Identify for which addresses we need to fetch balances
  const neededBalances: BlockNumberToAffectedAddresses = events.reduce((acc, event) => {
    const blockNumberSet = acc.get(event.blockNumber)
    if (blockNumberSet) {
      addToSet(blockNumberSet, event, web3);
    }
    else {
      const newSet = new ValueSet();
      addToSet(newSet, event, web3);
      acc.set(event.blockNumber, newSet)
    }
    return acc;
  }, new Map() as BlockNumberToAffectedAddresses)


  // const promises: Promise<AddressContractBalance[]>[] = Array.from(neededBalances.entries()).flatMap(([blockNumber, addressSet]) => {
  //   return breakNeededBalancesPerBatch(addressSet.values()).map((addressContract: AddressContract[]) => {
  //     return getBalancesPerBlock(web3, addressContract, blockNumber)
  //   })

  // })

  const addresses: [number, AddressContract[]][] = [];

  for (const [blockNumber, addressSet] of Array.from(neededBalances.entries())) {
    const brokenPerBatchAddresses: AddressContract[][] = breakNeededBalancesPerBatch(addressSet.values())
    brokenPerBatchAddresses.map((addressContract: AddressContract[]) => {
      addresses.push([blockNumber, addressContract])
    })
  }

  const results: BlockNumberAddressContractBalance[] = []
  for (const blockNumberAddress of addresses) {
    let result: BlockNumberAddressContractBalance[] = [];
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
      addToMap(balances, result);
    }
    else {
      const newMap: AddressContractToBalance = new Map();
      addToMap(newMap, result);
      acc.set(blockNumber, newMap)
    }
    ++index;
    return acc;
  }, new Map() as BlockNumberToBalances)

  // Array.from(balanceMap.get(19000171)!.entries()).forEach(pair => {
  //   console.log(`${pair[0]} --> ${pair[1]}`)
  // })


  for (const event of events) {
    if (isAddressEligableForBalance(web3, event.from, event.contract)) {
      event.fromBalance = balanceMap.get(event.blockNumber)?.get(concatAddressAndContract(event.from, event.contract))
      assertIsDefinedLazy(event.fromBalance, () => `'from' balance should have been resovled for event ${JSON.stringify(event)}`)
    }

    if (isAddressEligableForBalance(web3, event.to, event.contract)) {
      event.toBalance = balanceMap.get(event.blockNumber)?.get(concatAddressAndContract(event.to, event.contract))
      assertIsDefinedLazy(event.toBalance, () => `'to' balance should have been resovled for event ${JSON.stringify(event)}`)
    }
  }
}

class ValueSet {
  private elements: AddressContract[];

  constructor() {
    this.elements = [];
  }

  has(item: AddressContract) {
    return this.elements.some(element => this.isEqual(element, item));
  }

  add(item: AddressContract) {
    if (!this.has(item)) {
      this.elements.push(item);
    }
  }

  isEqual(array1: AddressContract, array2: AddressContract) {
    if (array1.length !== array2.length) {
      return false;
    }
    for (let i = 0; i < array1.length; i++) {
      if (array1[i] !== array2[i]) {
        return false;
      }
    }
    return true;
  }

  values() {
    return [...this.elements];
  }
}

