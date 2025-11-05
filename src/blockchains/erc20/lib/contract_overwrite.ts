import BigNumber from 'bignumber.js';
import { ERC20Transfer } from '../erc20_types';

export type ContractOverwriteConfig = {
  new_address: string;
  old_contracts: Array<{
    address: string;
    multiplier: number;
  }>;
};

/**
 * For one token - all overwritten addresses along with the overwriting address.
 */
export class ContractOverwrite {
  public readonly newContract: string;
  public readonly oldAddresses: string[];
  public readonly mapAddressToMultiplier: Record<string, number>;

  constructor(parsedContract: ContractOverwriteConfig) {
    this.newContract = parsedContract.new_address.toLowerCase();
    this.oldAddresses = [];
    this.mapAddressToMultiplier = {};

    for (const oldContract of parsedContract.old_contracts) {
      const oldContractLower = oldContract.address.toLowerCase();
      this.oldAddresses.push(oldContractLower);
      const multiplierValue = typeof oldContract.multiplier === 'number'
        ? oldContract.multiplier
        : Number(oldContract.multiplier);
      if (!Number.isFinite(multiplierValue)) {
        throw new Error(`Multiplier for contract ${oldContract.address} must be numeric`);
      }
      this.mapAddressToMultiplier[oldContractLower] = multiplierValue;
    }
  }
}

/**
 * Modifies the provided events in place, updating contract info when an overwrite matches.
 */
export function changeContractAddresses(events: ERC20Transfer[], contractsOverwriteArray: ContractOverwrite[]): void {
  for (const event of events) {
    for (const contractOverwrite of contractsOverwriteArray) {
      if (contractOverwrite.oldAddresses.includes(event.contract)) {
        editAddressAndAmount(event, contractOverwrite);
        break;
      }
    }
  }
}

/**
 * Updates the contract address and value fields on the provided event according to overwrite rules.
 */
export function editAddressAndAmount(event: ERC20Transfer, contractOverwrite: ContractOverwrite): void {
  const multiplier: number | undefined = contractOverwrite.mapAddressToMultiplier[event.contract];
  if (multiplier === undefined) {
    throw new Error('Event contract does not match expected');
  }

  const valueBigNumber = new BigNumber(event.value.toString());
  const updatedValue = valueBigNumber.multipliedBy(multiplier);
  event.value = BigInt(updatedValue.toFixed(0));

  /**
   * Note 1: Whether we should round here is up for discussion. The amounts in our pipeline are 'float' anyways but up until this feature
   * actual values have always been Integers. Choosing to round for simplicity and backwards compatibility.
   *
   * Note 2: The decision whether to divide one of the contract values or multiply the other is also up for discussion. By dividing (and rounding)
   * we loose precision and possibly mis-represent small amounts on the affected contract. The other possible decision is to multiply
   * amounts on the contract using smaller amounts but in this way we may generate too huge values. We are choosing the first option.
   */
  const bigNumber = new BigNumber(event.valueExactBase36, 36).multipliedBy(multiplier);
  event.valueExactBase36 = bigNumber.toString(36);
  event.contract = contractOverwrite.newContract;
}

/**
 * Returns a deep copy list of the events with overwrites applied; original array is left untouched.
 */
export function extractChangedContractAddresses(
  events: ERC20Transfer[],
  contractsOverwriteArray: ContractOverwrite[],
): ERC20Transfer[] {
  const result: ERC20Transfer[] = [];

  for (const event of events) {
    for (const contractOverwrite of contractsOverwriteArray) {
      if (contractOverwrite.oldAddresses.includes(event.contract)) {
        const clonedEvent: ERC20Transfer = { ...event };
        editAddressAndAmount(clonedEvent, contractOverwrite);
        result.push(clonedEvent);
        break;
      }
    }
  }

  return result;
}
