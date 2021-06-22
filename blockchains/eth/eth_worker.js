const Web3 = require('web3')
const jayson = require('jayson/promise');
const { filterErrors } = require('blockchain-utils/eth')
const constants = require('./lib/constants')
const { logger } = require('../../lib/logger')
const { injectDAOHackTransfers, DAO_HACK_FORK_BLOCK } = require('./lib/dao_hack')
const { addGenesisTransfers } = require('./lib/genesis_transfers')
const { transactionOrder, stableSort, computeGasExpense,
  computeGasExpenseBase36 } = require('./lib/util')
const BaseWorker = require('../../lib/worker_base')


class ETHWorker extends BaseWorker {
  constructor() {
    super()

    logger.info(`Connecting to parity node ${constants.PARITY_NODE}`)
    this.web3 = new Web3(new Web3.providers.HttpProvider(constants.PARITY_NODE))
    this.parityClient = jayson.client.http(constants.PARITY_NODE);
  }

  fetchEthInternalTrx(fromBlock, toBlock) {
    return this.parityClient.request('trace_filter', [{
      fromBlock: this.parseNumberToHex(fromBlock),
      toBlock: this.parseNumberToHex(toBlock)
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

  parseValueExactBase36(field) {
    return this.web3.utils.toBN(field).toString(36)
  }

  parseHexToNumberString(field) {
    return this.web3.utils.hexToNumberString(field)
  }

  parseHexToNumber(field) {
    return this.web3.utils.hexToNumber(field)
  }

  parseNumberToHex(field) {
    return this.web3.utils.numberToHex(field)
  }

  parseValue(trace) {
    return parseFloat(this.parseHexToNumberString(trace["action"]["value"]))
  }

  parseValueBase36(trace) {
    return this.parseValueExactBase36(trace["action"]["value"])
  }

  parseTransactionPosition(trace) {
    return this.parseHexToNumberString(trace["transactionPosition"])
  }

  parseBalance(trace) {
    return parseFloat(this.parseHexToNumberString(trace["action"]["balance"]))
  }

  parseBalanceBase36(trace) {
    return this.parseValueExactBase36(trace["action"]["balance"])
  }

  decodeTransferTrace(trace, blocks) {
    const timestamp = this.parseHexToNumber(blocks.get(trace["blockNumber"]).timestamp)

    // Block & uncle rewards
    if (trace["type"] == "reward") {
      return {
        from: `mining_${trace["action"]["rewardType"]}`,
        to: trace["action"]["author"],
        value: this.parseValue(trace),
        valueExactBase36: this.parseValueBase36(trace),
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
        value: this.parseValue(trace),
        valueExactBase36: this.parseValueBase36(trace),
        blockNumber: trace["blockNumber"],
        timestamp: timestamp,
        transactionHash: trace["transactionHash"],
        transactionPosition: this.parseTransactionPosition(trace),
        type: trace["type"]
      }
    }

    if (trace["type"] == "suicide") {
      return {
        from: trace["action"]["address"],
        to: trace["action"]["refundAddress"],
        value: this.parseBalance(trace),
        valueExactBase36: this.parseBalanceBase36(trace),
        blockNumber: trace["blockNumber"],
        timestamp: timestamp,
        transactionHash: trace["transactionHash"],
        transactionPosition: this.parseTransactionPosition(trace),
        type: trace["type"]
      }
    }

    if (trace["type"] != "call") {
      logger.warn("Unknown trace type: " + JSON.stringify(trace))
    }

    return {
      from: trace["action"]["from"],
      to: trace["action"]["to"],
      value: this.parseValue(trace),
      valueExactBase36: this.parseValueBase36(trace),
      blockNumber: trace["blockNumber"],
      timestamp: timestamp,
      transactionHash: trace["transactionHash"],
      transactionPosition: this.parseTransactionPosition(trace),
      type: trace["type"]
    }
  }

  async fetchBlocks(fromBlock, toBlock) {
    const blockRequests = []
    for (let i = fromBlock; i <= toBlock; i++) {
      blockRequests.push(
        this.parityClient.request(
          'eth_getBlockByNumber',
          [this.parseNumberToHex(i), true],
          undefined,
          false
        )
      )
    }

    const responses = await this.parityClient.request(blockRequests);
    const result = new Map()
    responses.forEach((response, index) => result.set(fromBlock + index, response.result))
    return result
  }

  async fetchReceipts(blocks) {
    const responses = []

    blocks.forEach((block, blockNumber) => {
      const req = this.parityClient.request('parity_getBlockReceipts', [this.parseNumberToHex(blockNumber)], undefined, false)
      responses.push(this.parityClient.request([req]))
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

  decodeTransactionsInBlock(block, receipts) {
    const result = []
    block.transactions.forEach((transaction) =>
      result.push({
        from: transaction.from,
        to: block.miner,
        value: computeGasExpense(this.web3, transaction.gasPrice, receipts[transaction.hash].gasUsed),
        valueExactBase36: computeGasExpenseBase36(this.web3, transaction.gasPrice, receipts[transaction.hash].gasUsed),
        blockNumber: this.parseHexToNumber(transaction.blockNumber),
        timestamp: this.parseHexToNumber(block.timestamp),
        transactionHash: transaction.hash,
        type: "fee"
      })
    )
    return result
  }

  async getPastEvents(fromBlock, toBlock) {
    logger.info(`Fetching traces for blocks ${fromBlock}:${toBlock}`)

    const [traces, blocks] = await Promise.all([
      this.fetchEthInternalTrx(fromBlock, toBlock),
      this.fetchBlocks(fromBlock, toBlock)
    ])

    const result = []

    for (let i = 0; i < traces.length; i++) {
      result.push(this.decodeTransferTrace(traces[i], blocks))
    }

    logger.info(`Fetching receipts of ${fromBlock}:${toBlock}`)
    const receipts = await this.fetchReceipts(blocks)

    blocks.forEach((block) => {
      const decoded_transactions = this.decodeTransactionsInBlock(block, receipts)
      result.push(...decoded_transactions)
    })

    if (fromBlock == 0) {
      logger.info("Adding the GENESIS transfers")
      result.push(...addGenesisTransfers(this.web3, result))
    }

    if (fromBlock <= DAO_HACK_FORK_BLOCK && DAO_HACK_FORK_BLOCK <= toBlock) {
      logger.info("Adding the DAO hack transfers")
      result.push(...injectDAOHackTransfers(result))
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
    .then(this.healthcheckExportTimeout())
  }

}

module.exports = {
  worker: ETHWorker
}
