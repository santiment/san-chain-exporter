class Web3Wrapper {
    constructor(web3) {
        this.web3 = web3;
    }

    castBigIntToNumber(bigIntValue) {
        const minSafe = BigInt(Number.MIN_SAFE_INTEGER);
        const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
        if (bigIntValue >= minSafe && bigIntValue <= maxSafe) {
            return Number(bigIntValue);
        }
        else {
            throw new Error(`BigInt value ${bigIntValue} can not be safely cast to Number`);
        }
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

    parseHexToBase36String(field) {
        return BigInt(this.web3.utils.hexToNumberString(field)).toString(36);
    }

    async getBlockNumber() {
        return this.castBigIntToNumber(await this.web3.eth.getBlockNumber());
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
