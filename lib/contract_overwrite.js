"use strict";

const fs = require('fs')
const { getPastEvents } = require('./fetch_events')
const { logger } = require('../logger')
var BigNumber = require('bignumber.js');

/**
 * For one token - all overwritten addresses along with the overwriting address.
 */
class ContractOverwrite {
  constructor(parsedContract) {
    this.newContract = parsedContract.new_address;
    this.oldAddresses = []
    this.mapAddressToMultiplier = {};

    for (const oldContract of parsedContract.old_contracts) {
      this.oldAddresses.push(oldContract.address);
      this.mapAddressToMultiplier[oldContract.address] = oldContract.multiplier;
    }
  }
}

class ContractEditor {
  constructor() {
    const parsedContracts = JSON.parse(fs.readFileSync("./lib/contract_mapping.json", {encoding: "utf8"}));
    this.contractsOverwriteArray = parsedContracts.map((parsedContract) => new ContractOverwrite(parsedContract))

    logger.info(`Running in 'exact contracts mode', ${this.contractsOverwriteArray.length} contracts will be monitored.`)
  }

  editAddressAndAmount(events, contractOverwrite) {
    for(let event of events) {
      if (contractOverwrite.oldAddresses.includes(event.contract)) {

        const multiplier = contractOverwrite.mapAddressToMultiplier[event.contract];
        event.contract = contractOverwrite.newContract;
        // Whether we should round here is up for discussion. The amounts in our pipeline are 'float' anyways but up until this feature
        // actual values have always been Integers. Choosing to round for simplicity and not having super long values.
        event.value = Math.floor(event.value * multiplier);
        const bigNumber = new BigNumber(event.valueExactBase36, 36).times(multiplier).integerValue();
        event.valueExactBase36 =bigNumber.toString(36)
      }
    }
  }

  async getPastEventsExactContracts(web3, fromBlock, toBlock) {
    let resultsAggregation = [];

    for (const contractOverwrite of this.contractsOverwriteArray) {
      let events = await getPastEvents(web3, fromBlock, toBlock, contractOverwrite.oldAddresses);
      this.editAddressAndAmount(events, contractOverwrite);
      resultsAggregation = resultsAggregation.concat(events);
    }

    return resultsAggregation;
  }

}

const contractEditor = new ContractEditor();

async function getPastEventsExactContracts(web3, fromBlock, toBlock) {
  return await contractEditor.getPastEventsExactContracts(web3, fromBlock, toBlock);
}

/** Exposed only for test purposes */
async function changeContractAddresses(events) {
  for (let event of events) {
    for (const contractOverwrite of contractEditor.contractsOverwriteArray) {
      if (event.contract in contractOverwrite.mapAddressToMultiplier) {
        contractEditor.editAddressAndAmount([event], contractOverwrite);
      }
    }
  }
}


module.exports = {
  getPastEventsExactContracts,
  changeContractAddresses
}
