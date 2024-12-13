import { expect } from 'earl';
import { transactionOrder } from "../../blockchains/eth/lib/util"
import { ETHTransfer } from '../../blockchains/eth/eth_types';

describe('utils', () => {
    it('should sort by block number', () => {
        const transfers: ETHTransfer[] = [{
            from: "fromAddress",
            to: "toAddress",
            value: 100,
            valueExactBase36: "2S",
            blockNumber: 2,
            timestamp: 1000,
            transactionHash: "hash",
            transactionPosition: 10,
            internalTransactionPosition: 0,
            type: "type"
        }, {
            from: "fromAddress",
            to: "toAddress",
            value: 100,
            valueExactBase36: "2S",
            blockNumber: 1,
            timestamp: 2000,
            transactionHash: "hash",
            transactionPosition: 10,
            internalTransactionPosition: 0,
            type: "type"
        }
        ]
        const result = transfers.sort(transactionOrder)
        expect(result[0].blockNumber).toEqual(1);
        expect(result[1].blockNumber).toEqual(2);
    })

    it('should sort by transaciton position', () => {
        const transfers: ETHTransfer[] = [{
            from: "fromAddress",
            to: "toAddress",
            value: 100,
            valueExactBase36: "2S",
            blockNumber: 1,
            timestamp: 1000,
            transactionHash: "hash",
            transactionPosition: 20,
            internalTransactionPosition: 0,
            type: "type"
        }, {
            from: "fromAddress",
            to: "toAddress",
            value: 100,
            valueExactBase36: "2S",
            blockNumber: 1,
            timestamp: 2000,
            transactionHash: "hash",
            transactionPosition: 10,
            internalTransactionPosition: 0,
            type: "type"
        }
        ]
        const result = transfers.sort(transactionOrder)
        expect(result[0].transactionPosition).toEqual(10);
        expect(result[1].transactionPosition).toEqual(20);
    })


    it('should sort by internal transaciton position', () => {
        const transfers: ETHTransfer[] = [{
            from: "fromAddress",
            to: "toAddress",
            value: 100,
            valueExactBase36: "2S",
            blockNumber: 1,
            timestamp: 1000,
            transactionHash: "hash",
            internalTransactionPosition: 5,
            type: "type"
        }, {
            from: "fromAddress",
            to: "toAddress",
            value: 100,
            valueExactBase36: "2S",
            blockNumber: 1,
            timestamp: 2000,
            transactionHash: "hash",
            internalTransactionPosition: 2,
            type: "type"
        }
        ]
        const result = transfers.sort(transactionOrder)
        expect(result[0].internalTransactionPosition).toEqual(2);
        expect(result[1].internalTransactionPosition).toEqual(5);
    })
})