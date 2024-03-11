const fs = require('fs').promises;
const { logger } = require('../../../lib/logger');

const decodeAddress = (value) => {
  return '0x' + value.substring(value.length - 40);
};

function stableSort(array, sortFunc) {
  array.forEach((x, i) => x._position = i);

  array.sort(function (a, b) {
    let sortResult = sortFunc(a, b);
    if (sortResult !== 0) {
      return sortResult;
    }
    else {
      return a._position - b._position;
    }
  });

  array.forEach(x => delete x._position);
}

async function readJsonFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const parsedContracts = JSON.parse(data);
    return parsedContracts;
  } catch (err) {
    logger.error(err);
    throw err;
  }
}

module.exports = {
  decodeAddress,
  stableSort,
  readJsonFile
};
