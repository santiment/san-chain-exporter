
class Web3Wrapper {

    constructor(web3) {
        this.web3 = web3
    }

    parseValueExactBase36(field) {
        return this.web3.utils.toBN(field).toString(36)
    }

    parseHexToNumberString(field) {
        return this.web3.utils.hexToNumberString(field)
    }

    parseHexToNumber(field) {
        return this.web3.utils.hexToNumber(field)
    }

    parseNumberToHex(field) {
        return this.web3.utils.numberToHex(field)
    }

    parseValue(trace) {
        return parseFloat(this.parseHexToNumberString(trace["action"]["value"]))
    }

    parseValueBase36(trace) {
        return this.parseValueExactBase36(trace["action"]["value"])
    }

    parseTransactionPosition(trace) {
        return this.parseHexToNumberString(trace["transactionPosition"])
    }

    parseBalance(trace) {
        return parseFloat(this.parseHexToNumberString(trace["action"]["balance"]))
    }

    parseBalanceBase36(trace) {
        return this.parseValueExactBase36(trace["action"]["balance"])
    }
}


module.exports = Web3Wrapper
