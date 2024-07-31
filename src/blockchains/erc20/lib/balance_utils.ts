import { isAddress } from 'web3-validator';
import { ERC20Transfer } from '../erc20_types';
import { Web3 } from 'web3';
import { ZERO_ADDRESS } from './fetch_events';

export type AddressContractToBalance = Map<string, string>;
export type AddressContract = [string, string]
export type BlockNumberAddressContractBalance = [number, string, string, string]

const MAX_BALANCES_PER_QUERY = 50;


export function decodeRevertReason(web3: Web3, errorData: string) {
  try {
    return web3.eth.abi.decodeParameter('string', '0x' + errorData.slice(10));
  } catch (e) {
    return 'Unable to decode error data';
  }
}



export function addToSet(set: ValueSet, event: ERC20Transfer) {
  if (isAddressEligableForBalance(event.from, event.contract)) {
    set.add([event.from, event.contract]);
  }
  if (isAddressEligableForBalance(event.to, event.contract)) {
    set.add([event.to, event.contract]);
  }
}

export function concatAddressAndContract(address: string, contract: string): string {
  return address + "-" + contract
}

export function addToMap(map: AddressContractToBalance, balance: BlockNumberAddressContractBalance) {
  //console.log(`Adding balance ${balance[0]}-${balance[1]}-${balance[2]}-${balance[3]}`)
  const concatenation = concatAddressAndContract(balance[1], balance[2])
  map.set(concatenation, balance[3])
}

export function breakNeededBalancesPerBatch(input: AddressContract[]): AddressContract[][] {
  const result = [];
  for (let i = 0; i < input.length; i += MAX_BALANCES_PER_QUERY) {
    result.push(input.slice(i, i + MAX_BALANCES_PER_QUERY));
  }
  return result;
}

export function isAddressEligableForBalance(address: string, contract: string): boolean {
  return isAddress(address) && address !== ZERO_ADDRESS && address !== contract
}

export class ValueSet {
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

