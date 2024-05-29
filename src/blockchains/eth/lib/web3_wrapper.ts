import { Web3 } from 'web3';
import Web3HttpProvider, { HttpProviderOptions } from 'web3-providers-http';
import { buildHttpOptions } from '../../../lib/build_http_options';

export interface Web3Interface {
    parseHexToNumberString(field: string): string;
    parseHexToNumber(field: string): number | bigint;
    parseNumberToHex(field: number): string;
    parseHexToBase36String(field: string): string;
    getBlockNumber(): Promise<number>;
    getPastLogs(queryObject: any): Promise<any>;
    etherToWei(amount: string): number;
    gweiToWei(amount: string): number;
}

class Web3Wrapper implements Web3Interface {
    private web3: Web3;
    private lastBlockNumber: number;

    constructor(web3: Web3) {
        this.web3 = web3;
        this.lastBlockNumber = 0;
    }

    parseHexToNumberString(field: string): string {
        return this.web3.utils.hexToNumberString(field);
    }

    /**
     * Converts value to it's number representation. Returns bigint or number depending on value.
     */
    parseHexToNumber(field: string): number | bigint {
        return this.web3.utils.hexToNumber(field);
    }

    parseNumberToHex(field: number): string {
        return this.web3.utils.numberToHex(field);
    }

    parseHexToBase36String(field: string): string {
        return BigInt(this.web3.utils.hexToNumberString(field)).toString(36);
    }

    async getBlockNumber(): Promise<number> {
        // We are casting to Number here due to how this field is expected in our pipeline
        this.lastBlockNumber = Number(await this.web3.eth.getBlockNumber());
        return this.lastBlockNumber;
    }

    async getPastLogs(queryObject: any): Promise<any> {
        return await this.web3.eth.getPastLogs(queryObject);
    }

    async getBlock(blockNumber: number): Promise<any> {
        return await this.web3.eth.getBlock(blockNumber, false);
    }

    etherToWei(amount: string): number {
        return Number(this.web3.utils.toWei(amount, 'ether'));
    }

    gweiToWei(amount: string): number {
        return Number(this.web3.utils.toWei(amount, 'gwei'));
    }
}

export function safeCastToNumber(value: number | bigint): number {
    if (value > Number.MAX_SAFE_INTEGER) {
        throw Error(`Value ${value} is too big to be casted to number`)
    }

    return Number(value)
}

export function constructWeb3Wrapper(nodeURL: string, username: string, password: string): Web3Interface {
    const authCredentials = username + ':' + password;
    const httpProviderOptions: HttpProviderOptions = buildHttpOptions(authCredentials);
    return new Web3Wrapper(new Web3(new Web3HttpProvider(nodeURL, httpProviderOptions)));
}

export function constructWeb3WrapperNoCredentials(nodeURL: string): Web3Interface {
    return new Web3Wrapper(new Web3(new Web3HttpProvider(nodeURL)));
}


