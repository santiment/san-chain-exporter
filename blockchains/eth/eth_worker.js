const Web3 = require('web3')
const jayson = require('jayson/promise');
const { filterErrors } = require('blockchain-utils/eth')
const constants = require('./lib/constants')
const { injectDAOHackTransfers, DAO_HACK_FORK_BLOCK } = require('./lib/dao_hack')
const { addGenesisTransfers } = require('./lib/genesis_transfers')
const { transactionOrder, stableSort } = require('./lib/util')


class ETHWorker extends BaseWorker {
  constructor() {
    super()

    logger.info(`Connecting to parity node ${constants.PARITY_NODE}`)
    this.web3 = new Web3(new Web3.providers.HttpProvider(constants.PARITY_NODE))
    this.parityClient = jayson.client.http(PARITY_URL);
  }

  fetchEthInternalTrx(fromBlock, toBlock) {
    return parityClient.request('trace_filter', [{
      fromBlock: this.web3.utils.numberToHex(fromBlock),
      toBlock: this.web3.utils.numberToHex(toBlock)
    }]).then((data) => {
      const traces = filterErrors(data["result"])

      return traces
        .filter((trace) =>
          trace["action"]["value"] != "0x0" &&
          trace["action"]["balance"] != "0x0" &&
          !(trace["type"] == "call" && trace["action"]["callType"] != "call")
        )
    })
  }

  decodeTransferTrace(trace, blocks) {
    const web3 = this.web3
    const timestamp = web3.utils.hexToNumber(blocks.get(trace["blockNumber"]).timestamp)

    // Block & uncle rewards
    if (trace["type"] == "reward") {
      return {
        from: `mining_${trace["action"]["rewardType"]}`,
        to: trace["action"]["author"],
        value: parseFloat(web3.utils.hexToNumberString(trace["action"]["value"])),
        valueExactBase36: web3.utils.toBN(trace["action"]["value"]).toString(36),
        blockNumber: trace["blockNumber"],
        timestamp: timestamp,
        type: trace["type"]
      }
    }

    // Contract creation
    if (trace["type"] == "create") {
      return {
        from: trace["action"]["from"],
        to: trace["result"]["address"],
        value: parseFloat(web3.utils.hexToNumberString(trace["action"]["value"])),
        valueExactBase36: web3.utils.toBN(trace["action"]["value"]).toString(36),
        blockNumber: trace["blockNumber"],
        timestamp: timestamp,
        transactionHash: trace["transactionHash"],
        transactionPosition: web3.utils.hexToNumber(trace["transactionPosition"]),
        type: trace["type"]
      }
    }

    if (trace["type"] == "suicide") {
      return {
        from: trace["action"]["address"],
        to: trace["action"]["refundAddress"],
        value: parseFloat(web3.utils.hexToNumberString(trace["action"]["balance"])),
        valueExactBase36: web3.utils.toBN(trace["action"]["balance"]).toString(36),
        blockNumber: trace["blockNumber"],
        timestamp: timestamp,
        transactionHash: trace["transactionHash"],
        transactionPosition: web3.utils.hexToNumber(trace["transactionPosition"]),
        type: trace["type"]
      }
    }

    if (trace["type"] != "call") {
      console.warn("Unknown trace type: " + JSON.stringify(trace))
    }

    return {
      from: trace["action"]["from"],
      to: trace["action"]["to"],
      value: parseFloat(web3.utils.hexToNumberString(trace["action"]["value"])),
      valueExactBase36: web3.utils.toBN(trace["action"]["value"]).toString(36),
      blockNumber: trace["blockNumber"],
      timestamp: timestamp,
      transactionHash: trace["transactionHash"],
      transactionPosition: web3.utils.hexToNumber(trace["transactionPosition"]),
      type: trace["type"]
    }
  }

  async fetchBlocks(fromBlock, toBlock) {
    const blockRequests = []
    for (let i = fromBlock; i <= toBlock; i++) {
      blockRequests.push(
        parityClient.request(
          'eth_getBlockByNumber',
          [this.web3.utils.numberToHex(i), true],
          undefined,
          false
        )
      )
    }

    const responses = await parityClient.request(blockRequests);
    const result = new Map()
    responses.forEach((response, index) => result.set(fromBlock + index, response.result))
    return result
  }

  async fetchReceipts(blocks) {
    const responses = []

    blocks.forEach((block, blockNumber) => {
      const req = parityClient.request('parity_getBlockReceipts', [this.web3.utils.numberToHex(blockNumber)], undefined, false)
      responses.push(parityClient.request([req]))
    })

    const finishedRequests = await Promise.all(responses)
    const result = {}

    finishedRequests.forEach((blockResponses) => {
      if (!blockResponses) return

      blockResponses.forEach((blockResponse) => {
        if (blockResponse.result) {
          blockResponse.result.forEach((receipt) => {
            result[receipt.transactionHash] = receipt
          })
        }
      })
    })

    return result
  }

  async getPastEvents(fromBlock, toBlock) {
    const web3 = this.web3
    console.info(`Fetching traces for blocks ${fromBlock}:${toBlock}`)

    const [traces, blocks] = await Promise.all([
      fetchEthInternalTrx(fromBlock, toBlock),
      fetchBlocks(fromBlock, toBlock)
    ])

    let result = []

    for (let i = 0; i < traces.length; i++) {
      result.push(decodeTransferTrace(traces[i], blocks))
    }

    console.log(`Fetching receipts of ${fromBlock}:${toBlock}`)
    const receipts = await fetchReceipts(blocks)

    blocks.forEach((block) => {
      block.transactions.forEach((transaction) =>
        result.push({
          from: transaction.from,
          to: block.miner,
          value: parseFloat(web3.utils.hexToNumberString(transaction.gasPrice)) * parseFloat(web3.utils.hexToNumberString(receipts[transaction.hash].gasUsed)),
          valueExactBase36: web3.utils.toBN(transaction.gasPrice).mul(web3.utils.toBN(receipts[transaction.hash].gasUsed)).toString(36),
          blockNumber: web3.utils.hexToNumber(transaction.blockNumber),
          timestamp: web3.utils.hexToNumber(block.timestamp),
          transactionHash: transaction.hash,
          type: "fee"
        })
      )
    })

    if (fromBlock == 0) {
      console.log("Adding the GENESIS transfers")
      result = addGenesisTransfers(web3, result)
    }

    if (fromBlock <= DAO_HACK_FORK_BLOCK && DAO_HACK_FORK_BLOCK <= toBlock) {
      console.log("Adding the DAO hack transfers")
      result = injectDAOHackTransfers(result)
    }

    return result
  }

  async work() {
    if (this.lastConfirmedBlock == this.lastExportedBlock) {
      // We are up to date with the blockchain (aka 'current mode'). Sleep longer after finishing this loop.
      this.sleepTimeMsec = constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;

      // On the previous cycle we closed the gap to the head of the blockchain.
      // Check if there are new blocks now.
      const newConfirmedBlock = await this.web3.eth.getBlockNumber() - constants.CONFIRMATIONS
      if (newConfirmedBlock == this.lastConfirmedBlock) {
        // The Node has not progressed
        return
      }
      this.lastConfirmedBlock = newConfirmedBlock
    }
    else {
      // We are still catching with the blockchain (aka 'historic mode'). Do not sleep after this loop.
      this.sleepTimeMsec = 0
    }

    const toBlock = Math.min(this.lastExportedBlock + constants.BLOCK_INTERVAL, this.lastConfirmedBlock)
    logger.info(`Fetching transfer events for interval ${this.lastExportedBlock}:${toBlock}`)
    this.lastRequestStartTime = new Date();

    const events = await this.getPastEvents(this.lastExportedBlock + 1, toBlock)

    if (events.length > 0) {
      stableSort(events, transactionOrder)
      for (let i = 0; i < events.length; i++) {
        events[i].primaryKey = this.lastPrimaryKey + i + 1
      }

      this.lastPrimaryKey += events.length
    }

    this.lastExportTime = Date.now()
    this.lastExportedBlock = toBlock

    return events
  }

  async init() {
    this.lastConfirmedBlock = await this.web3.eth.getBlockNumber() - constants.CONFIRMATIONS
  }

  healthcheckExportTimeout() {
    const timeFromLastExport = Date.now() - this.lastExportTime
    const isExportTimeoutExceeded = timeFromLastExport > constants.EXPORT_TIMEOUT_MLS
    if (isExportTimeoutExceeded) {
      return Promise.reject(`Time from the last export ${timeFromLastExport}ms exceeded limit  ${constants.EXPORT_TIMEOUT_MLS}ms.`)
    } else {
      return Promise.resolve()
    }
  }

  healthcheck() {
    return this.web3.eth.getBlockNumber()
    .then(healthcheckExportTimeout())
  }

}

module.exports = {
  ETHWorker
}
