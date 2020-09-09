"use strict";

const fs = require('fs')
const { getPastEvents } = require('./fetch_events')
const { logger } = require('../logger')

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

    console.log(`Running in 'exact contracts mode', ${this.contractsOverwriteArray.length} contracts will be monitored.`)
    logger.info(`Running in 'exact contracts mode', ${this.contractsOverwriteArray.length} contracts will be monitored.`)
  }

  editAddressAndAmount(web3, events, contractOverwrite) {
    for(let event of events) {
      if (contractOverwrite.oldAddresses.includes(event.contract)) {

        const multiplier = contractOverwrite.mapAddressToMultiplier[event.contract];
        event.contract = contractOverwrite.newContract;
        event.value = event.value *= multiplier;
        event.valueExactBase36 = web3.utils.toBN(event.value).toString(36)
      }
    }
  }

  async getPastEventsExactContracts(web3, fromBlock, toBlock) {
    let resultsAggregation = [];

    for (const contractOverwrite of this.contractsOverwriteArray) {
      let events = await getPastEvents(web3, fromBlock, toBlock, contractOverwrite.oldAddresses);
      this.editAddressAndAmount(web3, events, contractOverwrite);
      resultsAggregation = resultsAggregation.concat(events);
    }

    return resultsAggregation;
  }

}

const contractEditor = new ContractEditor();

async function getPastEventsExactContracts(web3, fromBlock, toBlock) {
  return await contractEditor.getPastEventsExactContracts(web3, fromBlock, toBlock);
}



module.exports = {
  getPastEventsExactContracts
}
