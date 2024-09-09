import { isAddress } from 'web3-validator';
import { ERC20Transfer } from '../erc20_types';
import { Web3 } from 'web3';
import { ZERO_ADDRESS } from './fetch_events';

export type AddressContractToBalance = Map<string, string>;
export type AddressContract = [string, string]
export type BlockNumberAddressContractBalance = [number, string, string, string]
export type AddressContractToMulticallResult = [AddressContract, any]


export function addToSet(set: AddressContractStore, event: ERC20Transfer) {
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
  const concatenation = concatAddressAndContract(balance[1], balance[2])
  map.set(concatenation, balance[3])
}

export function breakNeededBalancesPerBatch(input: AddressContract[], batchSize: number): AddressContract[][] {
  const result = [];
  for (let i = 0; i < input.length; i += batchSize) {
    result.push(input.slice(i, i + batchSize));
  }
  return result;
}

export function isAddressEligableForBalance(address: string, contract: string): boolean {
  return isAddress(address) && address !== ZERO_ADDRESS && address !== contract
}

// A custom Set data structure which would compare elements by value
export class AddressContractStore {
  private elements: AddressContract[];

  constructor() {
    this.elements = [];
  }

  private has(item: AddressContract) {
    return this.elements.some(element => this.isEqual(element, item));
  }

  private isEqual(array1: AddressContract, array2: AddressContract) {
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

  add(item: AddressContract) {
    if (!this.has(item)) {
      this.elements.push(item);
    }
  }

  values() {
    return [...this.elements];
  }
}

