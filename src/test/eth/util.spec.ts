import { expect } from 'earl';
import { cloneDeep } from 'lodash';
import { transactionOrder, assignInternalTransactionPosition } from "../../blockchains/eth/lib/util"
import { ETHTransfer } from '../../blockchains/eth/eth_types';

describe('transactionOrder utils', () => {
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


describe('assignInternalTransactionPosition utils', () => {
    it('missing field is added', () => {
        const transfers: ETHTransfer[] = [{
            from: "fromAddress",
            to: "toAddress",
            value: 100,
            valueExactBase36: "2S",
            blockNumber: 2,
            timestamp: 1000,
            transactionHash: "hash",
            transactionPosition: 10,
            type: "type"
        }]
        const expected = cloneDeep(transfers)
        expected[0].internalTransactionPosition = 0

        const result = assignInternalTransactionPosition(transfers)

        expect(result).toEqual(expected)
    })

    it('zero position is not changed', () => {
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
        }]
        const expected = cloneDeep(transfers)

        const result = assignInternalTransactionPosition(transfers)
        expect(result).toEqual(expected)
    })

    it('two different records assigned correctly', () => {
        // Transaction hash is different even though they are in the same block. Expect not to get grouped.
        const transfers: ETHTransfer[] = [{
            from: "fromAddress",
            to: "toAddress",
            value: 100,
            valueExactBase36: "2S",
            blockNumber: 2,
            timestamp: 1000,
            transactionHash: "hash1",
            transactionPosition: 1,
            type: "type"
        },
        {
            from: "fromAddress",
            to: "toAddress",
            value: 100,
            valueExactBase36: "2S",
            blockNumber: 2,
            timestamp: 1000,
            transactionHash: "hash2",
            transactionPosition: 2,
            type: "type"
        }]
        const expected = cloneDeep(transfers)
        expected[0].internalTransactionPosition = 0
        expected[1].internalTransactionPosition = 0

        const result = assignInternalTransactionPosition(transfers)
        expect(result).toEqual(expected)
    })

    it('two equal records assigned correctly', () => {
        // Records are equal based on 'group by' criteria. Expect to get grouped.
        const transfers: ETHTransfer[] = [{
            from: "fromAddress",
            to: "toAddress",
            value: 100,
            valueExactBase36: "2S",
            blockNumber: 2,
            timestamp: 1000,
            transactionHash: "hash",
            transactionPosition: 10,
            type: "type"
        },
        {
            from: "fromAddress",
            to: "toAddress",
            value: 50,
            valueExactBase36: "1S",
            blockNumber: 2,
            timestamp: 1000,
            transactionHash: "hash",
            transactionPosition: 10,
            type: "type"
        }]
        const expected = cloneDeep(transfers)
        expected[0].internalTransactionPosition = 0
        expected[1].internalTransactionPosition = 1

        const result = assignInternalTransactionPosition(transfers)
        expect(result).toEqual(expected)
    })
})