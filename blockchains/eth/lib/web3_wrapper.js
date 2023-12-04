const { types } = require('web3');

const NUMBER_DATA_FORMAT = { bytes: types.FMT_BYTES.HEX, number: types.FMT_NUMBER.NUMBER };

class Web3Wrapper {
    constructor(web3) {
        this.web3 = web3;

    }

    parseHexToNumberString(field) {
        return this.web3.utils.hexToNumberString(field);
    }

    parseHexToNumber(field) {
        const result = this.web3.utils.hexToNumber(field);
        return result;
    }

    parseNumberToHex(field) {
        return this.web3.utils.numberToHex(field);
    }

    parseHexToBase36String(field) {
        return BigInt(this.web3.utils.hexToNumberString(field)).toString(36);
    }

    async getBlockNumber() {
        return await this.web3.eth.getBlockNumber(NUMBER_DATA_FORMAT);
    }

    async getPastLogs(queryObject) {
        return await this.web3.eth.getPastLogs(queryObject, NUMBER_DATA_FORMAT);
    }

    async getBlock(blockNumber) {
        return await this.web3.eth.getBlock(blockNumber, false,
            NUMBER_DATA_FORMAT);
    }

    etherToWei(amount) {
        return this.web3.toWei(amount, 'ether');
    }
}


module.exports = Web3Wrapper;
