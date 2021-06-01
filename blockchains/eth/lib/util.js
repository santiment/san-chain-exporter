function transactionOrder(a, b) {
  return a.blockNumber - b.blockNumber
}

function stableSort(array, sortFunc) {
  array.forEach((x, i) => x._position = i)

  array.sort(function (a, b) {
    let sortResult = sortFunc(a, b)
    if (sortResult != 0) {
      return sortResult
    }
    else {
      return a._position - b._position
    }
  })

  array.forEach(x => delete x._position)
}

function computeGasExpense (web3, gasPrice, gasUsed) {
  return parseFloat(web3.utils.hexToNumberString(gasPrice)) *
    parseFloat(web3.utils.hexToNumberString(gasUsed))
}

function computeGasExpenseBase36 (web3, gasPrice, gasUsed) {
  return web3.utils.toBN(gasPrice).mul(web3.utils.toBN(gasUsed)).toString(36)
}

module.exports = {
  transactionOrder,
  stableSort,
  computeGasExpense,
  computeGasExpenseBase36
}