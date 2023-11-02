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
    fetchBlocksList.__set__('EXPORT_BLOCKS_LIST_MAX_INTERVAL', 5);
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