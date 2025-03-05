import assert from 'assert';
import { Web3 } from 'web3';
import Web3HttpProvider, { HttpProviderOptions } from 'web3-providers-http';
import { buildHttpOptions } from '../../../lib/build_http_options';

export interface Web3Interface {
    getBlockNumber(): Promise<number>;
    getPastLogs(queryObject: any): Promise<any>;
}

function containsOnly0Andx(input: string) {
    const chars = Array.from(input);

    return chars.length > 0 && chars.every(char => char === '0' || char === 'x' || char === 'X');
}

export class Web3Wrapper implements Web3Interface {
    private web3: Web3;

    constructor(web3: Web3) {
        this.web3 = web3;
    }

    async getBlockNumber(): Promise<number> {
        // We are casting to Number here due to how this field is expected in our pipeline
        return Number(await this.web3.eth.getBlockNumber());
    }

    async getPastLogs(queryObject: any): Promise<any> {
        return await this.web3.eth.getPastLogs(queryObject);
    }

    async getBlock(blockNumber: number): Promise<any> {
        return await this.web3.eth.getBlock(blockNumber, false);
    }

    getWeb3(): Web3 {
        return this.web3;
    }

}


/**
 * A set of static Web3 functions which do not require connection to a Node
 */
export class Web3Static {
    private static web3: Web3 = new Web3();

    static parseHexToNumberString(field: string): string {
        return Web3Static.web3.utils.hexToNumberString(field);
    }

    /**
     * Converts value to it's number representation. Returns bigint or number depending on value.
     */
    static parseHexToNumber(field: string): number | bigint {
        // We want to interpret values which are not technically correct as 0. For example '0x'.
        if (containsOnly0Andx(field)) {
            return 0
        }
        else {
            return Web3Static.web3.utils.hexToNumber(field);
        }
    }

    static parseNumberToHex(field: number): string {
        return Web3Static.web3.utils.numberToHex(field);
    }

    static parseHexToBase36String(field: string): string {
        return BigInt(Web3Static.web3.utils.hexToNumberString(field)).toString(36);
    }

    static etherToWei(amount: string): number {
        return Number(Web3Static.web3.utils.toWei(amount, 'ether'));
    }

    static gweiToWei(amount: string): number {
        return Number(Web3Static.web3.utils.toWei(amount, 'gwei'));
    }
}

export function safeCastToNumber(value: number | bigint): number {
    assert(value > Number.MIN_SAFE_INTEGER && value < Number.MAX_SAFE_INTEGER,
        (`Value ${value} is too big to be casted to number`));

    return Number(value)
}

export function constructWeb3Wrapper(nodeURL: string, username: string, password: string): Web3Interface {
    const authCredentials = username + ':' + password;
    const httpProviderOptions: HttpProviderOptions = buildHttpOptions(authCredentials);
    return new Web3Wrapper(new Web3(new Web3HttpProvider(nodeURL, httpProviderOptions)));
}


