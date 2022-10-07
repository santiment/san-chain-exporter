
class Web3Wrapper {

    constructor(web3) {
        this.web3 = web3;
    }

    parseValueToBN(field) {
        return this.web3.utils.toBN(field);
    }

    parseHexToNumberString(field) {
        return this.web3.utils.hexToNumberString(field);
    }

    parseHexToNumber(field) {
        return this.web3.utils.hexToNumber(field);
    }

    parseNumberToHex(field) {
        return this.web3.utils.numberToHex(field);
    }

    parseValue(field) {
        return parseFloat(this.parseHexToNumberString(field));
    }

    parseValueBase36(field) {
        return this.parseValueToBN(field).toString(36);
    }

    parseTransactionPosition(field) {
        return this.parseHexToNumber(field);
    }

    parseBalance(field) {
        return parseFloat(this.parseHexToNumberString(field));
    }

    parseBalanceBase36(field) {
        return this.parseValueBase36(field);
    }

    decodeTimestampFromBlock(block) {
        return this.parseHexToNumber(block.timestamp);
    }
}


module.exports = Web3Wrapper;
