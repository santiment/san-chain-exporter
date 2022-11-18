/* jslint es6 */
'use strict';
const got = require('got');
const uuidv1 = require('uuid/v1');
const BaseWorker = require('../../lib/worker_base');
const constants = require('./lib/constants');
const util = require('./lib/util');
const { logger } = require('../../lib/logger');

const CARDANO_GRAPHQL_URL = process.env.CARDANO_GRAPHQL_URL || 'http://localhost:3100/graphql';
const DEFAULT_TIMEOUT_MSEC = parseInt(process.env.DEFAULT_TIMEOUT || '30000');
const CARDANO_NODE_API_RETRIES = parseInt(process.env.CARDANO_NODE_API_RETRIES || '3');

class CardanoWorker extends BaseWorker {
  constructor() {
    super();
    this.retryAttempt = 0;
  }

  async sendRequest(query) {
    try {
      return await got.post(CARDANO_GRAPHQL_URL, {
        json: {
          jsonrpc: '2.0',
          id: uuidv1(),
          query: query
        },
        responseType: 'json',
        timeout: DEFAULT_TIMEOUT_MSEC
      }).json();
    }
    catch (error) {
      throw new Error(`Error sending request to Cardano GraphQL: ${error.message}`);
    }
  }

  async getCurrentBlock() {
    const response = await this.sendRequest('{ cardano { tip { number } } }');

    if (response.data === null) {
      throw new Error('Error getting Cardano current block number');
    }
    return response.data.cardano.tip.number;
  }

  async getGenesisTransactionsPage(offset) {
    const response = await this.sendRequest(`
    {
      transactions(
          where: {
            block: { hash: { _eq: "5f20df933584822601f9e3f8c024eb5eb252fe8cefb24d1317dc3d432e940ebb" } }
          }
          offset: ${offset}
          order_by: { includedAt: asc }
        ) {
          includedAt
          blockIndex
          fee
          hash

          block {
            number
            epochNo
            transactionsCount
          }

          inputs {
            address
            value
          }

          outputs {
            address
            value
          }
        }
      }
    `);

    if (response.data === null) {
      throw new Error(`Error getting transactions for genesis block offset: ${offset}`);
    }

    return response.data.transactions;
  }

  async getGenesisTransactions() {
    let current_offset = 0;
    const transactionsMerged = [];
    let transactionsBatch = [];

    do {
      transactionsBatch = await this.getGenesisTransactionsPage(current_offset);
      transactionsMerged.push(...transactionsBatch);
      current_offset += transactionsBatch.length;
    }
    while (transactionsBatch.length > 0);

    logger.info(`Extracted ${transactionsMerged.length} genesis transactions`);
    return transactionsMerged;
  }

  // Genesis transfers have block number set to 'null'. For our computation purposes we need some block number.
  // We set it to 0.
  setBlockZeroForGenesisTransfers(transactions) {
    transactions.forEach(transaction => {
      if (transaction.block.number) {
        throw new Error(`Unexpected block number ${transaction.block.number} for genesis transaction
        ${transaction.hash}`);
      }
      transaction.block.number = 0;
    });
  }

  async getTransactions(blockNumber, lastConfirmedBlock) {
    logger.info(`Getting transactions for interval ${blockNumber} - ${lastConfirmedBlock}`);
    const response = await this.sendRequest(`
    {
      transactions(
        where: {
          block: { epoch: { number: { _is_null: false } } }
          _and: [{ block: { number: { _gte: ${blockNumber} } } },
                 { block: { number: { _lte: ${lastConfirmedBlock} } } }]
        }
        order_by: { includedAt: asc }
      ) {
        includedAt
        blockIndex
        fee
        hash

        block {
          number
          epochNo
          transactionsCount
        }

        inputs {
          address
          value
        }

        outputs {
          address
          value
        }

      }
    }`);

    if (response.data === null) {
      throw new Error(`Error getting transactions for current block number ${blockNumber}`);
    }

    return response.data.transactions;
  }

  async init() {
    this.lastConfirmedBlock = await this.getCurrentBlock() - constants.CONFIRMATIONS;
  }

  async work() {
    // If we have entered here as result of a retry attempt, do not calculate new intervals,
    // instead try out the last one.
    if (0 === this.retryAttempt) {
      if (this.lastExportedBlock >= this.lastConfirmedBlock - 2) {
        // We are up to date with the blockchain (aka 'current mode'). Sleep longer after finishing this loop.
        // The last confirmed block may be partial and would not be exported. Allow for two block gap as the last
        // block may have been incomplete and we did not extract it on the last iteration.
        this.sleepTimeMsec = constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;
        logger.info(`Sleep time set to ${constants.LOOP_INTERVAL_CURRENT_MODE_SEC}, current mode`);
        // On the previous cycle we closed the gap to the head of the blockchain.
        // Check if there are new blocks now.
        const newConfirmedBlock = await this.getCurrentBlock() - constants.CONFIRMATIONS;
        if (newConfirmedBlock === this.lastConfirmedBlock) {
          // The Node has not progressed
          return [];
        }
        this.lastConfirmedBlock = newConfirmedBlock;
      }
      else {
        // We are still catching with the blockchain (aka 'historic mode'). Do not sleep after this loop.
        this.sleepTimeMsec = 0;
        logger.info('Sleep time set to 0, historic mode');
      }
    }


    let transactions = null;
    try {
      if (this.lastExportedBlock < 0) {
        transactions = await this.getGenesisTransactions();
        if (transactions.length === 0) {
          throw new Error('Error getting Cardano genesis transactions');
        }
        this.setBlockZeroForGenesisTransfers(transactions);
      }
      else {
        const fromBlock = this.lastExportedBlock + 1;
        transactions = await this.getTransactions(fromBlock, this.lastConfirmedBlock);
        if (transactions.length === 0) {
          this.lastExportedBlock = this.lastConfirmedBlock;
          return [];
        }
      }

      transactions = util.discardNotCompletedBlock(transactions);
      util.verifyAllBlocksComplete(transactions);
      this.retryAttempt = 0;
    }
    catch (error) {
      if (this.retryAttempt > CARDANO_NODE_API_RETRIES) {
        throw new Error(`Error sending request to Cardano GraphQL: ${error.message}`);
      }
      else {
        logger.warn(`Error sending request to Cardano GraphQL: ${error.message}`);
        this.retryAttempt += 1;
        return [];
      }
    }

    for (let i = 0; i < transactions.length; i++) {
      transactions[i].primaryKey = this.lastPrimaryKey + i + 1;
    }

    this.lastExportTime = Date.now();
    this.lastExportedBlock = transactions[transactions.length - 1].block.number;
    this.lastPrimaryKey += transactions.length;

    return transactions;
  }
}

module.exports = {
  worker: CardanoWorker
};
