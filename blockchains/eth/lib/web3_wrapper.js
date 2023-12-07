class Web3Wrapper {
    constructor(web3) {
        this.web3 = web3;
    }

    parseHexToNumberString(field) {
        return this.web3.utils.hexToNumberString(field);
    }

    /**
     * Converts value to it's number representation. Returns bigint or number depending on value.
     */
    parseHexToNumber(field) {
        return this.web3.utils.hexToNumber(field);
    }

    parseNumberToHex(field) {
        return this.web3.utils.numberToHex(field);
    }

    parseHexToBase36String(field) {
        return BigInt(this.web3.utils.hexToNumberString(field)).toString(36);
    }

    async getBlockNumber() {
        // We are casting to Number here due to how this field is expected in our pipeline
        return Number(await this.web3.eth.getBlockNumber());
    }

    async getPastLogs(queryObject) {
        return await this.web3.eth.getPastLogs(queryObject);
    }

    async getBlock(blockNumber) {
        return await this.web3.eth.getBlock(blockNumber, false);
    }

    etherToWei(amount) {
        return this.web3.utils.toWei(amount, 'ether');
    }
}


module.exports = Web3Wrapper;
