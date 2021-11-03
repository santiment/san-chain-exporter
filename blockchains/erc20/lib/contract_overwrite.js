"use strict";

const { getPastEvents } = require('./fetch_events')
const { logger } = require('../../../lib/logger')
var BigNumber = require('bignumber.js');
const constants = require('./constants')
var parsedContracts = require(constants.CONTRACT_MAPPING_FILE_PATH)

/**
 * For one token - all overwritten addresses along with the overwriting address.
 */
class ContractOverwrite {
  constructor(parsedContract) {
    this.newContract = parsedContract.new_address.toLowerCase();
    this.oldAddresses = []
    this.mapAddressToMultiplier = {};

    for (const oldContract of parsedContract.old_contracts) {
      const oldContractLower = oldContract.address.toLowerCase()
      this.oldAddresses.push(oldContractLower);
      this.mapAddressToMultiplier[oldContractLower] = oldContract.multiplier;
    }
  }
}

class ContractEditor {
  constructor() {
    this.contractsOverwriteArray = parsedContracts.map((parsedContract) => new ContractOverwrite(parsedContract))

    logger.info(`Running in '${constants.CONTRACT_MODE}' contracts mode', ` +
     `${this.contractsOverwriteArray.length} contracts will be monitored.`)
    logger.info(`Overwritten contracts are: ${JSON.stringify(this.contractsOverwriteArray)}`)
  }

  isContractMatchesExactList(event, contractOverwrite) {
    return contractOverwrite.oldAddresses.includes(event.contract)
  }

  editAddressAndAmount(event, contractOverwrite) {
    const multiplier = contractOverwrite.mapAddressToMultiplier[event.contract];
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
    event.valueExactBase36 =bigNumber.toString(36)
  }

  async getPastEventsExactContracts(web3, fromBlock, toBlock) {
    let resultsAggregation = []

    for (const contractOverwrite of this.contractsOverwriteArray) {
      const events = await getPastEvents(web3, fromBlock, toBlock, contractOverwrite.oldAddresses)
      resultsAggregation = resultsAggregation.concat(events)
    }

    return resultsAggregation
  }

  /**
   *
   * @param events A list of events to go over and check contract address. Events needing contract change will
   * have the change applied.
   */
  changeContractAddresses(events) {
    for(let event of events) {
      for (const contractOverwrite of this.contractsOverwriteArray) {
        if (this.isContractMatchesExactList(event, contractOverwrite)) {
          this.editAddressAndAmount(event, contractOverwrite)
          break
        }
      }
    }
  }

  /**
   *
   * @param events A list of events to go over and check contract address.
   * @returns A deep copy of the events which have had change applied.
   */
   extractChangedContractAddresses(events) {
    const result = []

    for(let event of events) {
      for (const contractOverwrite of this.contractsOverwriteArray) {
        if (this.isContractMatchesExactList(event, contractOverwrite)) {
          event = JSON.parse(JSON.stringify(event))
          this.editAddressAndAmount(event, contractOverwrite)
          result.push(event)
          break
        }
      }
    }

    return result
  }
}

const contractEditor = constants.CONTRACT_MODE != "vanilla" ? new ContractEditor() : null



module.exports = {
  contractEditor
}
