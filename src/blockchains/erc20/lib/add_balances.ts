import { assertIsDefined } from '../../../lib/utils';
import { ERC20Transfer } from '../erc20_types';
import { Web3 } from 'web3';

type AddressContractToBalance = Map<[string, string], string>;
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
  if (blockNumber === 19000171) {
    let count = 0
    addressContract.forEach(address => {
      if (address[0] === '0x6b75d8af000000e20b7a7ddf000ba900b4009a80' && address[1] === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2') {
        ++count
      }
    })
    console.log("count is: ", count)
  }
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

  let index = 0;
  const results: AddressContractBalance[] = addressContract.map(([address, contractAddress]) => {
    const balanceData = result.returnData[index];
    const decoded: string = web3.eth.abi.decodeParameter('uint256', balanceData) as string;
    index++;
    if (blockNumber === 19000171 && address == '0x6b75d8af000000e20b7a7ddf000ba900b4009a80'
      && contractAddress == '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2') {
      console.log("Balance resolved as ", decoded)
    }
    return [address, contractAddress, decoded]
  });

  return results;
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

function addToMap(map: AddressContractToBalance, balances: AddressContractBalance[]) {
  for (const addressBalance of balances) {
    map.set([addressBalance[0], addressBalance[1]], addressBalance[2])
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
    console.log("Needed balances blockNumber: ", blockNumber)
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

  for (const event of events) {
    event.fromBalance = balanceMap.get(event.blockNumber)?.get([event.from, event.contract])
    event.toBalance = balanceMap.get(event.blockNumber)?.get([event.to, event.contract])
    assertIsDefined(event.fromBalance, `'from' balance should have been resovled for event ${JSON.stringify(event)}`)
    assertIsDefined(event.toBalance, `'to' balance should have been resovled for event ${event}`)
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

