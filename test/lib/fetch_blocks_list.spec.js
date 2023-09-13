const rewire = require('rewire');
const { expect } = require('chai');
const fetchBlocksList = rewire('../../lib/fetch_blocks_list');

describe('makeIntervals', () => {
  it('should return empty array if input is empty', () => {
    const makeIntervals = fetchBlocksList.__get__('makeIntervals');
    const result = makeIntervals([]);
    expect(result).to.deep.equal([]);
  });

  it('should return correct intervals 1', () => {
    const makeIntervals = fetchBlocksList.__get__('makeIntervals');
    const result = makeIntervals([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(result).to.deep.equal([[1, 5], [6, 9]]);
  });

  it('should return correct intervals 2', () => {
    const makeIntervals = fetchBlocksList.__get__('makeIntervals');
    const result = makeIntervals([1, 2, 3, 5, 6, 7, 8, 9, 11, 13, 14]);
    expect(result).to.deep.equal([[1, 3], [5, 9], [11, 11], [13, 14]]);
  });
});

describe('initBlocksList', () => {
  it('should throw error when getting the config isnt successful', async () => {
    const getConfigMapList = fetchBlocksList.__get__('getConfigMapList');
    fetchBlocksList.__set__('getConfigMapList', async () => Promise.reject(new Error('Error in file fetching')));
    try {
      await fetchBlocksList.initBlocksList();
    } catch (err) {
      expect(err.message).to.equal('Error in file fetching');
    }
    fetchBlocksList.__set__('getConfigMapList', getConfigMapList);
  });

  it('should return correct blocks intervals list', async () => {
    const getConfigMapList = fetchBlocksList.__get__('getConfigMapList');
    fetchBlocksList.__set__('getConfigMapList', async () => Promise.resolve(
      ['1', '2', '3', '5', '6', '7', '8', '9', '11', '13', '14']
    ));
    const result = await fetchBlocksList.initBlocksList();
    expect(result).to.deep.equal([[1, 3], [5, 9], [11, 11], [13, 14]]);
    fetchBlocksList.__set__('getConfigMapList', getConfigMapList);
  });
});

describe('initBlocksListPosition', () => {
  it('should return 0 if lastProcessedPosition is undefined', () => {
    const result = fetchBlocksList.initBlocksListPosition(undefined, [[1, 3], [5, 9], [11, 11], [13, 14]]);
    expect(result).to.equal(0);
  });

  it('should return 0 if lastProcessedPosition is {}', () => {
    const result = fetchBlocksList.initBlocksListPosition({}, [[1, 3], [5, 9], [11, 11], [13, 14]]);
    expect(result).to.equal(0);
  });

  it('should throw an error if lastProcessedPosition isnt found in the blocks list', () => {
    try {
      fetchBlocksList.initBlocksListPosition({blockNumber: 36, privateKey: -1}, [[1, 3], [5, 9], [11, 11], [13, 14]]);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).to.be.an('error');
      expect(error.message).to.equal('Block number 36 not found in blocks list');
    }
  });

  it('should return correct index if lastProcessedPosition is found in the blocks list', () => {
    const test1 = fetchBlocksList.initBlocksListPosition({blockNumber: 5, privateKey: -1}, [[1, 3], [5, 9], [11, 11], [13, 14]]);
    const test2 = fetchBlocksList.initBlocksListPosition({blockNumber: 11, privateKey: -1}, [[1, 3], [5, 9], [11, 11], [13, 14]]);
    expect(test1).to.equal(1);
    expect(test2).to.equal(2);
  });
});
