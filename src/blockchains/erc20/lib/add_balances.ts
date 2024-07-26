import { assertIsDefinedLazy } from '../../../lib/utils';
import { ERC20Transfer } from '../erc20_types';
import { Web3 } from 'web3';

type AddressContractToBalance = Map<string, string>;
type BlockNumberToBalances = Map<number, AddressContractToBalance>;
type AddressContract = [string, string]
type AddressContractBalance = [string, string, string]
type BlockNumberToAffectedAddresses = Map<number, ValueSet>;



const multicallAbi = [
  {
    "constant": true,
    "inputs": [
      {
        "components": [
          {
            "name": "target",
            "type": "address"
          },
          {
            "name": "callData",
            "type": "bytes"
          }
        ],
        "name": "calls",
        "type": "tuple[]"
      }
    ],
    "name": "aggregate",
    "outputs": [
      {
        "name": "blockNumber",
        "type": "uint256"
      },
      {
        "name": "returnData",
        "type": "bytes[]"
      }
    ],
    "payable": false,
    "stateMutability": "view",
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

async function getBalancesPerBlock(web3: Web3, addressContract: AddressContract[], blockNumber: number): Promise<AddressContractBalance[]> {
  const multicall = new web3.eth.Contract(multicallAbi, multicallAddress);

  const calls = addressContract.map(([address, contractAddress]) => {
    const contract = new web3.eth.Contract(ERC20_ABI, contractAddress);
    const data = contract.methods.balanceOf(address).encodeABI();
    return {
      target: contractAddress,
      callData: data
    };
  });

  const result: any = await multicall.methods.aggregate(calls).call({}, blockNumber);

  if (result.returnData.length !== addressContract.length) {
    throw new Error("Response size does not match");
  }

  let index = 0;
  return addressContract.map(([address, contractAddress]) => {
    const balanceData = result.returnData[index];
    const decoded: bigint = web3.eth.abi.decodeParameter('uint256', balanceData) as bigint
    index++;
    return [address, contractAddress, decoded.toString()]
  });
}

function addToSet(set: ValueSet, event: ERC20Transfer, web3: Web3) {
  // TODO migrate deprecation
  if (web3.utils.isAddress(event.from)) {
    set.add([event.from, event.contract]);
  }
  if (web3.utils.isAddress(event.to)) {
    set.add([event.to, event.contract]);
  }
}

function concatAddressAndContract(address: string, contract: string): string {
  return address + "-" + contract
}

function addToMap(map: AddressContractToBalance, balances: AddressContractBalance[]) {
  for (const addressBalance of balances) {
    map.set(concatAddressAndContract(addressBalance[0], addressBalance[1]), addressBalance[2])
  }
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

  const promises: Promise<AddressContractBalance[]>[] = Array.from(neededBalances.entries()).map(([blockNumber, addressSet]) => {
    return getBalancesPerBlock(web3, addressSet.values(), blockNumber)
  })

  const results: AddressContractBalance[][] = await Promise.all(promises);

  // Store the discovered balances in a Map structure for easy access
  let index = 0;
  const blockNumbers = Array.from(neededBalances.keys());
  const balanceMap = results.reduce((acc, result) => {
    const blockNumber = blockNumbers[index];
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
    if (web3.utils.isAddress(event.from)) {
      event.fromBalance = balanceMap.get(event.blockNumber)?.get(concatAddressAndContract(event.from, event.contract))
      assertIsDefinedLazy(event.fromBalance, () => `'from' balance should have been resovled for event ${JSON.stringify(event)}`)
    }

    if (web3.utils.isAddress(event.to)) {
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

