"use strict";

const fs = require('fs')
const { getPastEvents } = require('./fetch_events')
const { logger } = require('../logger')
var BigNumber = require('bignumber.js');

/**
 * For one token - all overwritten addresses along with the overwriting address.
 */
class ContractOverwrite {
  constructor(csvLine) {
    const csvLineContents = csvLine.split(",").map((element) => element.trim().toLowerCase());
    this.newContract = csvLineContents[csvLineContents.length - 1];
    this.oldAddresses = []
    this.mapAddressToMultiplier = {};

    for (let i = 0; i < csvLineContents.length - 1; i++) {
      const address = csvLineContents[i];
      const multiplier = csvLineContents[++i];

      this.oldAddresses.push(address);
      this.mapAddressToMultiplier[address] = multiplier;
    }
  }
}

class ContractEditor {
  constructor() {
    this.contractsOverwriteArray = fs.readFileSync("./lib/contract_mapping.csv", {encoding: "utf8"})
        .split("\n")
        .map( (x) => x.trim())
        .filter((line) => line != 0 && line[0] != '#')
        .map((line) => new ContractOverwrite(line))

        logger.info(`Running in 'exact contracts mode', ${this.contractsOverwriteArray.length} contracts will be monitored.`)
  }

  editAddressAndAmount(events, contractOverwrite) {
    for(let event of events) {
      if (contractOverwrite.oldAddresses.includes(event.contract)) {

        const multiplier = contractOverwrite.mapAddressToMultiplier[event.contract];
        event.contract = contractOverwrite.newContract;
        // Whether we should round here is up for discussion. The amounts in our pipeline are 'float' anyways but up until this feature
        // actual values have always been Integers. Choosing to round for simplicity and not having super long values.
        event.value = Math.floor(event.value *= multiplier);
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
