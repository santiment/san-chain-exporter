import { groupBy } from 'lodash';
import { ERC20Transfer } from '../erc20_types';
import { Web3 } from 'web3';

type AddressToBalnace = { [address: number]: number };
type BlockNumberToBalances = { [blockNumber: number]: AddressToBalnace };
type BlockNumberToAffectedAddresses = { [blockNumber: number]: Set<string> };

import { Web3Interface } from '../../eth/lib/web3_wrapper';

function getBalanceForAddress(address: string, blockNumber: number): number {
  // TODO
  return 0;
}


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

const multicallAddress = '0xeefBa1e63905eFB1AeFcFC3576477E0b*tB*a239'; // Update this with correct address

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


async function getBalances(web3: Web3, addresses: string[], contracts: string[], blockNumber: number) {
  const multicall = new web3.eth.Contract(multicallAbi, multicallAddress);

  const calls = [{}];
  addresses.forEach((address) => {
    contracts.forEach((contractAddress) => {
      const contract = new web3.eth.Contract(ERC20_ABI, contractAddress);
      const data = contract.methods.balanceOf(address).encodeABI();
      calls.push({
        target: contractAddress,
        callData: data
      });
    });
  });

  const returnData: any = await multicall.methods.aggregate(calls).call({}, blockNumber);

  const results = [{}];
  let index = 0;
  addresses.forEach((address) => {
    contracts.forEach((contractAddress) => {
      const balanceData = returnData[index];
      const decoded = web3.eth.abi.decodeParameter('uint256', balanceData);
      results.push({
        address,
        contract: contractAddress,
        balance: decoded
      });
      index++;
    });
  });

  return results;
}

const addresses = [
  '0xAddress1',
  '0xAddress2'
  // Add more addresses as needed
];

const contracts = [
  '0xContract1',
  '0xContract2'
  // Add more contract addresses as needed
];

getBalances(addresses, contracts).then(balances => {
  console.log(balances);
}).catch(error => {
  console.error('Error:', error);
});

export function extendTransfersWithBalances(events: ERC20Transfer[]) {
  // Identify for which addresses we need to fetch balances
  const neededBalances: BlockNumberToAffectedAddresses = events.reduce((acc, event) => {
    acc[event.blockNumber].add(event.from)
    return acc;
  }, {} as BlockNumberToAffectedAddresses)


}

