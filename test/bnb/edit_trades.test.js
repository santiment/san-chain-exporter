/*jshint esversion: 6 */
const assert = require('assert');
const edit_transactions = require('../../blockchains/bnb/lib/edit_transactions');

const trade1 = {
  'tradeId':'12773899-5',
  'blockHeight':12773899,
  'symbol':'ANKR-E97_BNB',
  'price':'0.00028132',
  'quantity':'260.00000000',
  'buyerOrderId':'BC44784B0C99AA301DAC66C8A477354E039FDB13-21906',
  'sellerOrderId':'1CE10E2705336B20545CA8B5D6B39DBDF0CCC866-3',
  'buyerId':'bnb1h3z8sjcvnx4rq8dvvmy2gae4fcpelkcn292qwu',
  'sellerId':'bnb1rnssufc9xd4jq4zu4z6advuahhcvejrxhxy2yd',
  'buyFee':'BNB:0.00014741;',
  'sellFee':'BNB:0.02521414;',
  'baseAsset':'ANKR-E97',
  'quoteAsset':'BNB',
  'buySingleFee':null,
  'sellSingleFee':null,
  'tickType':'Unknown',
  'time':1560410389381
};

const trade2 = {
  'tradeId':'12773899-31',
  'blockHeight':12773899,
  'symbol':'ANKR-E97_BNB',
  'price':'0.00028132',
  'quantity':'220.00000000',
  'buyerOrderId':'C28B0501CE8EF3911BF998414529762D9F443C9B-20562',
  'sellerOrderId':'1CE10E2705336B20545CA8B5D6B39DBDF0CCC866-3',
  'buyerId':'bnb1c29s2qww3meezxlenpq522tk9k05g0ym7zg2tc',
  'sellerId':'bnb1rnssufc9xd4jq4zu4z6advuahhcvejrxhxy2yd',
  'buyFee':'BNB:0.00051875;',
  'sellFee':'BNB:0.02521414;',
  'baseAsset':'ANKR-E97',
  'quoteAsset':'BNB',
  'buySingleFee':null,
  'sellSingleFee':null,
  'tickType':'Unknown',
  'time':1560410389381
};




describe('checkReordering and key generation', function() {
  it('Checking that the trades are being correctly ordered before stored to Kafka.', async function() {
    // The loop is only triggered here. The result would be saved in 'testResult' by the callback function.
    const result = edit_transactions.getTransactionsWithKeys([trade2, trade1]);

    // Add the keys to the objects as should be doing the tested function.
    trade1.primaryKey = '12773899-5';
    trade2.primaryKey = '12773899-31';

    // Expect the correct order and set keys.
    assert.deepEqual(
      result,
      [trade1, trade2]);
  });
});

