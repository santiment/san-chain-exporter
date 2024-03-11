const constants = require('../../blockchains/erc20/lib/constants');


// The primary key algorithm for non overwritten events
function calculatePrimaryKeyNonOverwrittenEvent(event) {
  return event.blockNumber * constants.PRIMARY_KEY_MULTIPLIER + event.logIndex;
}

function setExpectedEventPrimaryKey(event) {
  event.primaryKey = calculatePrimaryKeyNonOverwrittenEvent(event);
}


module.exports = {
  setExpectedEventPrimaryKey,
  calculatePrimaryKeyNonOverwrittenEvent
};