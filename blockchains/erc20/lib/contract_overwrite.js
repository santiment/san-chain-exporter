'use strict';

var BigNumber = require('bignumber.js');

/**
 * For one token - all overwritten addresses along with the overwriting address.
 */
class ContractOverwrite {
  constructor(parsedContract) {
    this.newContract = parsedContract.new_address.toLowerCase();
    this.oldAddresses = [];
    this.mapAddressToMultiplier = {};

    for (const oldContract of parsedContract.old_contracts) {
      const oldContractLower = oldContract.address.toLowerCase();
      this.oldAddresses.push(oldContractLower);
      this.mapAddressToMultiplier[oldContractLower] = oldContract.multiplier;
    }
  }
}

/**
 *
 * @param events A list of events to go over and check contract address. Events needing contract change will
 * have the change applied.
 */
function changeContractAddresses(events, contractsOverwriteArray) {
  for (const event of events) {
    for (const contractOverwrite of contractsOverwriteArray) {
      if (contractOverwrite.oldAddresses.includes(event.contract)) {
        editAddressAndAmount(event, contractOverwrite);
        break;
      }
    }
  }
}

function editAddressAndAmount(event, contractOverwrite) {
  const multiplier = contractOverwrite.mapAddressToMultiplier[event.contract];
  if (!multiplier) {
    throw new Error('Event contract does not match expected');
  }
  event.contract = contractOverwrite.newContract;
  /**
   * Note 1: Whether we should round here is up for discussion. The amounts in our pipeline are 'float' anyways but up until this feature
   * actual values have always been Integers. Choosing to round for simplicity and backwards compatibility.
   *
   * Note 2: The decision whether to divide one of the contract values or multiply the other is also up for discussion. By dividing (and rounding)
   * we loose precision and possibly mis-represent small amounts on the affected contract. The other possible decision is to multiply
   * amounts on the contract using smaller amounts but in this way we may generate too huge values. We are choosing the first option.
   */
  event.value = Math.floor(event.value * multiplier);
  const bigNumber = new BigNumber(event.valueExactBase36, 36).times(multiplier).integerValue();
  event.valueExactBase36 = bigNumber.toString(36);
}

/**
 *
 * @param events A list of events to go over and check contract address.
 * @returns A deep copy of the events which have had change applied.
 */
function extractChangedContractAddresses(events, contractsOverwriteArray) {
  const result = [];

  for (let event of events) {
    for (const contractOverwrite of contractsOverwriteArray) {
      if (contractOverwrite.oldAddresses.includes(event.contract)) {
        event = JSON.parse(JSON.stringify(event));
        editAddressAndAmount(event, contractOverwrite);
        result.push(event);
        break;
      }
    }
  }

  return result;
}


module.exports = {
  ContractOverwrite,
  editAddressAndAmount,
  extractChangedContractAddresses,
  changeContractAddresses
};
