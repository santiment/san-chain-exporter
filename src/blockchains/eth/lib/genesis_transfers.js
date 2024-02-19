const fs = require('fs');
const path = require('path');

const GENESIS_TRANSFERS = fs.readFileSync(path.resolve(__dirname) + '/ethereum_genesis.csv', { encoding: 'utf8' })
  .split('\n')
  .slice(0, -1)
  .map((line) => line.split(',').map((element) => element.trim()));

const GENESIS_TIMESTAMP = 1438269973;

exports.getGenesisTransfers = function (web3Wrapper) {
  const result = [];
  GENESIS_TRANSFERS.forEach((transfer) => {
    const [id, from, to, amount] = transfer;
    const wei = web3Wrapper.etherToWei(parseFloat(amount));

    result.push({
      from: 'GENESIS',
      to: to,
      value: wei,
      valueExactBase36: BigInt(wei).toString(36),
      blockNumber: 0,
      timestamp: GENESIS_TIMESTAMP,
      transactionHash: from,
      type: 'genesis'
    });
  });

  result.push({
    from: 'mining_block',
    to: '0x0000000000000000000000000000000000000000',
    value: '5000000000000000000',
    valueExactBase36: BigInt('5000000000000000000').toString(36),
    blockNumber: 0,
    timestamp: GENESIS_TIMESTAMP,
    type: 'reward'
  });

  return result;
};