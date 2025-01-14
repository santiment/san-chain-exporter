import { expect } from 'earl';
import { cloneDeep } from 'lodash';
import { transactionOrder, assignInternalTransactionPosition, checkETHTransfersQuality, mergeSortedArrays } from "../../blockchains/eth/lib/util"
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
            internalTxPosition: 0,
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
            internalTxPosition: 0,
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
            internalTxPosition: 0,
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
            internalTxPosition: 0,
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
            transactionPosition: 0,
            internalTxPosition: 5,
            type: "type"
        }, {
            from: "fromAddress",
            to: "toAddress",
            value: 100,
            valueExactBase36: "2S",
            blockNumber: 1,
            timestamp: 2000,
            transactionHash: "hash",
            transactionPosition: 0,
            internalTxPosition: 2,
            type: "type"
        }
        ]
        const result = transfers.sort(transactionOrder)
        expect(result[0].internalTxPosition).toEqual(2);
        expect(result[1].internalTxPosition).toEqual(5);
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
            internalTxPosition: 0,
            type: "type"
        }]
        const expected = cloneDeep(transfers)
        expected[0].internalTxPosition = 0

        assignInternalTransactionPosition(transfers)

        expect(transfers).toEqual(expected)
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
            internalTxPosition: 0,
            type: "type"
        }]
        const expected = cloneDeep(transfers)

        assignInternalTransactionPosition(transfers)
        expect(transfers).toEqual(expected)
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
            internalTxPosition: 0,
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
            internalTxPosition: 0,
            type: "type"
        }]
        const expected = cloneDeep(transfers)
        expected[0].internalTxPosition = 0
        expected[1].internalTxPosition = 0

        assignInternalTransactionPosition(transfers)
        expect(transfers).toEqual(expected)
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
            internalTxPosition: 0,
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
            internalTxPosition: 0,
            type: "type"
        }]
        const expected = cloneDeep(transfers)
        expected[0].internalTxPosition = 0
        expected[1].internalTxPosition = 1

        assignInternalTransactionPosition(transfers)
        expect(transfers).toEqual(expected)
    })
})

// Helper function to create ETHTransfer objects
const createTransfer = (
    from: string,
    to: string,
    value: number,
    blockNumber: number,
    transactionHash: string,
    transactionPosition: number,
    type: string = 'transfer'
): ETHTransfer => ({
    from, to, value, valueExactBase36: value.toString(36), blockNumber, timestamp: 1000, transactionHash,
    transactionPosition, internalTxPosition: 0, type,
});

describe('checkETHTransfersQuality', () => {
    it('Valid single block with single transaction', () => {
        const transfers: ETHTransfer[] = [
            createTransfer('A', 'B', 1, 100, "hash", 0),
        ]

        expect(() => checkETHTransfersQuality(transfers, 100, 100)).not.toThrow()
    })

    it('Valid transfers with multiple blocks and consecutive transactions', () => {
        const transfers: ETHTransfer[] = [
            createTransfer('A', 'B', 10, 100, "hash1", 0),
            createTransfer('C', 'D', 20, 100, "hash2", 1),
            createTransfer('E', 'F', 10, 101, "hash1", 0),
            createTransfer('G', 'H', 20, 101, "hash2", 1),
            createTransfer('I', 'J', 10, 102, "hash1", 0),
        ]

        expect(() => checkETHTransfersQuality(transfers, 100, 102)).not.toThrow()
    });

    it('Multiple transers with same transaction position', () => {
        const transfers: ETHTransfer[] = [
            createTransfer('A', 'B', 10, 100, "hash", 0),
            createTransfer('C', 'D', 20, 100, "hash", 0),
            createTransfer('E', 'F', 10, 100, "hash", 0),
        ]

        expect(() => checkETHTransfersQuality(transfers, 100, 100)).not.toThrow()
    });

    it('Throws error when a block in the range is missing', () => {
        const transfers: ETHTransfer[] = [
            createTransfer('A', 'B', 10, 100, "hash", 0),
            createTransfer('C', 'D', 20, 102, "hash", 0), // Missing block 101
            createTransfer('E', 'F', 10, 103, "hash", 0)
        ]

        expect(() => checkETHTransfersQuality(transfers, 100, 103)).toThrow('Wrong number of blocks seen. Expected 4 got 3.')
    })

    it('Throws error when a transaction position is missing within a block', () => {
        const transfers: ETHTransfer[] = [
            createTransfer('A', 'B', 10, 100, "hash", 0),
            // Missing transactionPosition 1 in block 100
            createTransfer('E', 'F', 20, 100, "hash1", 2),
            createTransfer('G', 'H', 10, 101, "hash2", 1),
        ]

        expect(() => checkETHTransfersQuality(transfers, 100, 101)).toThrow()
    })

    it('Throws error when transfers array is empty', () => {
        const transfers: ETHTransfer[] = []

        expect(() => checkETHTransfersQuality(transfers, 100, 100)).toThrow()
    })

    it('Throws error when fromBlock is greater than toBlock', () => {
        const transfers: ETHTransfer[] = [
            createTransfer('A', 'B', 1, 100, "hash", 0),
            createTransfer('C', 'D', 2, 101, "hash", 0),
        ]

        expect(() => checkETHTransfersQuality(transfers, 102, 100)).toThrow()
    })

    it('Throws error when the last block is missing', () => {
        const transfers: ETHTransfer[] = [
            createTransfer('A', 'B', 1, 100, "hash", 0),
            createTransfer('C', 'D', 2, 101, "hash", 0),
            // Missing block 102
        ];

        expect(() => checkETHTransfersQuality(transfers, 100, 102)).toThrow()
    })

    it('Throws error when the data for unexpected blocks is present', () => {
        const transfers: ETHTransfer[] = [
            createTransfer('A', 'B', 1, 100, "hash", 0),
            createTransfer('C', 'D', 2, 101, "hash", 0)
        ];

        expect(() => checkETHTransfersQuality(transfers, 102, 103)).toThrow()
    })
});


describe('mergeSortedArrays', () => {
    it('should return an empty array when merging two empty arrays', () => {

        const emptyArray1: ETHTransfer[] = []
        const emptyArray2: ETHTransfer[] = []

        const emptyArrayResult: ETHTransfer[] = []
        const result = mergeSortedArrays(emptyArray1, emptyArray2, transactionOrder)
        expect(result).toEqual(emptyArrayResult)
    })

    it('merging empty array to another array returns the latter', () => {

        const emptyArray: ETHTransfer[] = []
        const transfer = createTransfer('A', 'B', 1, 100, "hash", 0)

        const result = mergeSortedArrays(emptyArray, [transfer], transactionOrder)
        expect(result).toEqual([transfer])
    })

    it('merging non empty array to an empty array returns the former', () => {

        const emptyArray: ETHTransfer[] = []
        const transfer = createTransfer('A', 'B', 1, 100, "hash", 0)

        const result = mergeSortedArrays([transfer], emptyArray, transactionOrder)
        expect(result).toEqual([transfer])
    })

    it('all elements in first array are smaller', () => {
        const transfers1 = [
            createTransfer('A', 'B', 1, 100, "hash", 0),
            createTransfer('A', 'B', 1, 101, "hash", 0),
            createTransfer('A', 'B', 1, 102, "hash", 0),
        ]
        const transfers2 = [
            createTransfer('A', 'B', 1, 102, "hash", 1),
            createTransfer('A', 'B', 1, 103, "hash", 0),
            createTransfer('A', 'B', 1, 103, "hash", 1),
        ]

        const result = mergeSortedArrays(transfers1, transfers2, transactionOrder)

        expect(result).toEqual([...transfers1, ...transfers2])
    })

    it('all elements in second array are smaller', () => {
        const transfers1 = [
            createTransfer('A', 'B', 1, 100, "hash", 0),
            createTransfer('A', 'B', 1, 101, "hash", 0),
            createTransfer('A', 'B', 1, 102, "hash", 0),
        ]
        const transfers2 = [
            createTransfer('A', 'B', 1, 102, "hash", 1),
            createTransfer('A', 'B', 1, 103, "hash", 0),
            createTransfer('A', 'B', 1, 103, "hash", 1),
        ]

        const result = mergeSortedArrays(transfers2, transfers1, transactionOrder)

        expect(result).toEqual([...transfers1, ...transfers2])
    })

    it('test elements are merged correctly', () => {
        const transfer1 = createTransfer('A', 'B', 1, 100, "hash", 0)
        const transfer2 = createTransfer('A', 'B', 1, 101, "hash", 0)
        const transfer3 = createTransfer('A', 'B', 1, 102, "hash", 0)
        const transfer4 = createTransfer('A', 'B', 1, 102, "hash", 1)
        const transfer5 = createTransfer('A', 'B', 1, 103, "hash", 0)
        const transfer6 = createTransfer('A', 'B', 1, 103, "hash", 1)

        const result = mergeSortedArrays([transfer1, transfer3, transfer5], [transfer2, transfer4, transfer6], transactionOrder)

        expect(result).toEqual([transfer1, transfer2, transfer3, transfer4, transfer5, transfer6])
    })
})