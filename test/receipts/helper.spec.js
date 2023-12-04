const rewire = require('rewire');
const { expect } = require('chai');
const helper = rewire('../../blockchains/receipts/lib/helper');

const { Web3 } = require('web3');
const Web3Wrapper = require('./lib/web3_wrapper');

const web3Wrapper = new Web3Wrapper(new Web3());

describe('blocks parsing', () => {
  it('parses blocks', () => {
    const responses = [
      {
        jsonrpc: '2.0',
        result: { timestamp: '0x56c097f1', number: '0xf53d5' }
      },
      {
        jsonrpc: '2.0',
        result: { timestamp: '0x56c097f4', number: '0xf5408' }
      }
    ];

    const result = helper.parseBlocks(responses);
    expect(result).to.deep.eq([
      { timestamp: '0x56c097f1', number: '0xf53d5' },
      { timestamp: '0x56c097f4', number: '0xf5408' }
    ]);
  });
});

describe('receipt parsing', () => {
  it('parses receipts', () => {
    const responses = [
      {
        jsonrpc: '2.0',
        result: [
          {
            blockHash: '0x209bc40be9e6961d88435382b91754b7a6e180d6cbf9120a61246e1d2506f3a6',
            blockNumber: '0xf4fbb',
            contractAddress: null,
            cumulativeGasUsed: '0x5208',
            from: '0x2a65aca4d5fc5b5c859090a6c34d164135398226',
            gasUsed: '0x5208',
            logs: [],
            logsBloom: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
            root: '0x1806fd9f2ef8bf8dce03665b4c80a1740efe4194f90864c662e7af6a80a02a08',
            to: '0xe33977e292ccef99ea8828733e97562f3690a8ad',
            transactionHash: '0x88217032c83348c7aae522090d7a5b932609860a5f6760e98e9048f6ddc55ad8',
            transactionIndex: '0x0'
          }
        ]
      }
    ];

    const result = helper.parseReceipts(responses);
    expect(result).to.deep.eq(
      [
        {
          blockHash: '0x209bc40be9e6961d88435382b91754b7a6e180d6cbf9120a61246e1d2506f3a6',
          blockNumber: '0xf4fbb',
          contractAddress: null,
          cumulativeGasUsed: '0x5208',
          from: '0x2a65aca4d5fc5b5c859090a6c34d164135398226',
          gasUsed: '0x5208',
          logs: [],
          logsBloom: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
          root: '0x1806fd9f2ef8bf8dce03665b4c80a1740efe4194f90864c662e7af6a80a02a08',
          to: '0xe33977e292ccef99ea8828733e97562f3690a8ad',
          transactionHash: '0x88217032c83348c7aae522090d7a5b932609860a5f6760e98e9048f6ddc55ad8',
          transactionIndex: '0x0'
        }
      ]
    );
  });
});


context('receipt without logs', () => {
  const receipt = {
    blockHash: '0x209bc40be9e6961d88435382b91754b7a6e180d6cbf9120a61246e1d2506f3a6',
    blockNumber: '0xf4fbb',
    contractAddress: null,
    cumulativeGasUsed: '0x5208',
    from: '0x2a65aca4d5fc5b5c859090a6c34d164135398226',
    gasUsed: '0x5208',
    logs: [],
    logsBloom: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    root: '0x1806fd9f2ef8bf8dce03665b4c80a1740efe4194f90864c662e7af6a80a02a08',
    to: '0xe33977e292ccef99ea8828733e97562f3690a8ad',
    transactionHash: '0x88217032c83348c7aae522090d7a5b932609860a5f6760e98e9048f6ddc55ad8',
    transactionIndex: '0x0'
  };

  describe('receipt decoding', () => {
    it('converts blockNumber from hex to number', () => {
      const result = helper.decodeReceipt(receipt, web3Wrapper);
      expect(result.blockNumber).to.eq(1003451);
    });

    it('converts transactionIndex from hex to number', () => {
      const result = helper.decodeReceipt(receipt, web3Wrapper);
      expect(result.transactionIndex).to.eq(0);
    });

    it('converts cumulativeGasUsed from hex to number string', () => {
      const result = helper.decodeReceipt(receipt, web3Wrapper);
      expect(result.cumulativeGasUsed).to.eq('21000');
    });

    it('converts gasUsed from hex to number string', () => {
      const result = helper.decodeReceipt(receipt, web3Wrapper);
      expect(result.gasUsed).to.eq('21000');
    });

    it('removes logs key/value', () => {
      const result = helper.decodeReceipt(receipt, web3Wrapper);
      expect(result.logs).to.eq(undefined);
    });
  });
});


context('receipt with logs', () => {
  const receipt = {
    timestamp: '2020-10-02T08:51:25.779Z',
    level: 'info',
    blockHash: '0xa6e57d9dc2447ba63bef1dfd03b7885cf71753a93260f66016463b2e3b32d82e',
    blockNumber: 1004250,
    contractAddress: null,
    cumulativeGasUsed: '0x242F8',
    from: '0xae04420f8e66003b201ac5ec59cc529c2ec5b12f',
    gasUsed: '0xFAD8',
    logs: [
      {
        address: '0x6e3ded77aa29924ba55a87c23ee7d985b07212c6',
        blockHash: '0xa6e57d9dc2447ba63bef1dfd03b7885cf71753a93260f66016463b2e3b32d82e',
        blockNumber: '0xf52da',
        data: '0x0',
        logIndex: '0x0',
        removed: false,
        topics: ['0x92ca3a80853e6663fa31fa10b99225f18d4902939b4c53a9caae9043f6efd004'],
        transactionHash: '0xad637af875b539171853d144933b84680a93ccbefa22a68f127dc099fc26a43d',
        transactionIndex: '0x4',
        transactionLogIndex: '0x0',
        type: 'mined'
      }
    ],
    logsBloom: '0x0',
    root: '0x2b29b7a06c5bdd1d0287e0327bf2eb94a10bdd4ab9a11fce81787d6956d75f3b',
    to: '0x6e3ded77aa29924ba55a87c23ee7d985b07212c6',
    transactionHash: '0xad637af875b539171853d144933b84680a93ccbefa22a68f127dc099fc26a43d',
    transactionIndex: 4
  };

  describe('receipt decoding', () => {
    it('converts blockNumber from hex to number', () => {
      const result = helper.decodeReceipt(receipt, web3Wrapper);
      expect(result.blockNumber).to.eq(1004250);
    });

    it('converts transactionIndex from hex to number', () => {
      const result = helper.decodeReceipt(receipt, web3Wrapper);
      expect(result.transactionIndex).to.eq(4);
    });

    it('converts cumulativeGasUsed from hex to number string', () => {
      const result = helper.decodeReceipt(receipt, web3Wrapper);
      expect(result.cumulativeGasUsed).to.eq('148216');
    });

    it('converts gasUsed from hex to number string', () => {
      const result = helper.decodeReceipt(receipt, web3Wrapper);
      expect(result.gasUsed).to.eq('64216');
    });

    it('removes logs key/value', () => {
      const result = helper.decodeReceipt(receipt, web3Wrapper);
      expect(result.logs).to.eq(undefined);
    });

    it('merges columnized logs', () => {
      const result = helper.decodeReceipt(receipt, web3Wrapper);
      expect(result['logs.address']).to.deep.eq(['0x6e3ded77aa29924ba55a87c23ee7d985b07212c6']);
      expect(result['logs.data']).to.deep.eq(['0x0']);
      expect(result['logs.logIndex']).to.deep.eq([0]);
      expect(result['logs.removed']).to.deep.eq([false]);
      expect(result['logs.topics']).to.deep.
        eq([['0x92ca3a80853e6663fa31fa10b99225f18d4902939b4c53a9caae9043f6efd004']]);
      expect(result['logs.transactionLogIndex']).to.deep.eq([0]);
      expect(result['logs.type']).to.deep.eq(['mined']);
    });

    it('removes blockNumber key/value from logs', () => {
      const result = helper.decodeReceipt(receipt, web3Wrapper);
      expect(result['logs.blockNumber']).to.be.undefined;
    });

    it('removes blockHash key/value from logs', () => {
      const result = helper.decodeReceipt(receipt, web3Wrapper);
      expect(result['logs.blockHash']).to.be.undefined;
    });

    it('removes transactionHash key/value from logs', () => {
      const result = helper.decodeReceipt(receipt, web3Wrapper);
      expect(result['logs.transactionHash']).to.be.undefined;
    });

    it('removes transactionIndex key/value from logs', () => {
      const result = helper.decodeReceipt(receipt, web3Wrapper);
      expect(result['logs.transactionIndex']).to.be.undefined;
    });
  });
});

describe('setting reciept\'s timestamp', () => {
  it('sets receipt\'s timestamp', async () => {
    const receipt = { blockNumber: 1004250 };
    const timestamps = { '1004250': 1455576747 };
    const result = await helper.setReceiptsTimestamp([receipt], timestamps);

    expect(result).to.deep.eq([{ blockNumber: 1004250, timestamp: 1455576747 }]);
  });
});
