import { v1 as uuidv1 } from 'uuid';
import { BaseWorker } from '../../lib/worker_base';
import { Transaction } from './cardano_types';
import util from './lib/util';
import { logger } from '../../lib/logger';


export class CardanoWorker extends BaseWorker {
  private pRetry: any;
  private got: any;

  constructor(settings: any) {
    super(settings);
  }

  async sendRequest(query: string): Promise<any> {
    try {
      return await this.got.post(this.settings.CARDANO_GRAPHQL_URL, {
        json: {
          jsonrpc: '2.0',
          id: uuidv1(),
          query: query,
        },
        username: this.settings.RPC_USERNAME,
        password: this.settings.RPC_PASSWORD,
        responseType: 'json',
        timeout: {
          request: this.settings.DEFAULT_TIMEOUT_MSEC
        }
      }).json();
    }
    catch (error: any) {
      throw new Error(`Error sending request to Cardano GraphQL: ${error.message}`);
    }
  }

  async getCurrentBlock() {
    const response: any = await this.sendRequest('{ cardano { tip { number } } }');

    if (response.data === null) {
      throw new Error('Error getting Cardano current block number');
    }
    return response.data.cardano.tip.number;
  }

  async getGenesisTransactionsPage(offset: number): Promise<Transaction[]> {
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
  setBlockZeroForGenesisTransfers(transactions: Transaction[]) {
    transactions.forEach(transaction => {
      if (transaction.block.number) {
        throw new Error(`Unexpected block number ${transaction.block.number} for genesis transaction
        ${transaction.hash}`);
      }
      transaction.block.number = 0;
    });
  }

  async getTransactions(fromBlock: number, toBlock: number) {
    logger.info(`Getting transactions for interval ${fromBlock} - ${toBlock}`);
    const query = `{
    transactions(
       where: {
         block: { epoch: { number: { _is_null: false } } }
         _and: [
           { block: { number: { _gte: ${fromBlock} } } },
           { block: { number: { _lte: ${toBlock} } } }
         ]
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
    }`

    const response = await this.pRetry(() => this.sendRequest(query), {
      onFailedAttempt: (error: any) => {
        // Determine the error message
        const errorMessage = error.cause?.message || error.message || 'Unknown error';

        logger.warn(
          `Request ${fromBlock} - ${toBlock} is retried. ` +
          `There are ${error.retriesLeft} retries left. ` +
          `Error: ${errorMessage}`
        );
      },
      retries: this.settings.NODE_REQUEST_RETRY,
    });

    if (response.data === null) {
      throw new Error(`Error getting transactions for block interval ${fromBlock} - ${toBlock}`);
    }

    return response.data.transactions;
  }

  async setLastConfirmedBlock() {
    this.lastConfirmedBlock = await this.getCurrentBlock() - this.settings.CONFIRMATIONS;
  }

  async init() {
    const { default: got } = await import('got');
    this.got = got;
    await this.setLastConfirmedBlock();
    this.pRetry = (await import('p-retry')).default;
  }

  async work() {
    const fromBlock = this.lastExportedBlock + 1;
    if (fromBlock >= this.lastConfirmedBlock - 2) {
      // We are up to date with the blockchain (aka 'current mode'). Sleep longer after finishing this loop.
      // The last confirmed block may be partial and would not be exported. Allow for one block gap.
      this.sleepTimeMsec = this.settings.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;

      // On the previous cycle we closed the gap to the head of the blockchain.
      // Check if there are new blocks now. We want an interval of at least 2 blocks. For some reason the Cardano Node
      // API would return a partial last block. The same would not happen if the same block is fetched as part of 2
      // block interval.
      await this.setLastConfirmedBlock();
      if (this.lastConfirmedBlock < fromBlock + 2) {
        // The Node has not progressed enough
        return [];
      }
    }
    else {
      // We are still catching with the blockchain (aka 'historic mode'). Do not sleep after this loop.
      this.sleepTimeMsec = 0;
    }

    let transactions = null;
    if (this.lastExportedBlock < 0) {
      transactions = await this.getGenesisTransactions();
      if (transactions.length === 0) {
        throw new Error('Error getting Cardano genesis transactions');
      }
      this.setBlockZeroForGenesisTransfers(transactions);
    }
    else {
      transactions = await this.getTransactions(fromBlock, Math.min(this.lastConfirmedBlock,
        fromBlock + this.settings.BLOCK_INTERVAL - 1));
      if (transactions.length === 0) {
        // Move the export interval by one block. This would prevent entering a loop asking for same interval.
        this.lastExportedBlock = fromBlock;
        return [];
      }
    }

    transactions = util.discardNotCompletedBlock(transactions);
    util.verifyAllBlocksComplete(transactions);

    for (let i = 0; i < transactions.length; i++) {
      transactions[i].primaryKey = this.lastPrimaryKey + i + 1;
    }

    this.lastExportedBlock = transactions[transactions.length - 1].block.number;
    this.lastPrimaryKey += transactions.length;

    return transactions;
  }
}

