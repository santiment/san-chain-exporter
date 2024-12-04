import assert from 'assert';
import v8 from 'v8';
import { ETHWorker } from '../../blockchains/eth/eth_worker';
import { EOB } from '../../blockchains/eth/lib/end_of_block';
import * as constants from '../../blockchains/eth/lib/constants';
import { Trace, ETHBlock, ETHTransfer, ETHReceiptsMap } from '../../blockchains/eth/eth_types';
import { expect } from 'earl'

describe('Test worker', function () {
    let feeResult: ETHTransfer;
    let callResult: ETHTransfer;
    let endOfBlock: EOB;
    let eobWithPrimaryKey: EOB & { primaryKey: number };
    let worker = new ETHWorker(constants);
    let blockInfos = new Map<number, ETHBlock>()
    let feeResultWithPrimaryKey: ETHTransfer;
    let callResultWithPrimaryKey: ETHTransfer;

    beforeEach(function () {
        feeResult = {
            from: '0x03b16ab6e23bdbeeab719d8e4c49d63674876253',
            to: '0x829bd824b016326a401d083b33d092293333a830',
            value: 14086000000000000,
            valueExactBase36: '3up2j2e99ts',
            blockNumber: 5711193,
            timestamp: 1527814787,
            transactionHash: '0x1a06a3a86d2897741f3ddd774df060a63d626b01197c62015f404e1f007fa04d',
            type: 'fee'
        } satisfies ETHTransfer;

        callResult = {
            from: '0x03b16ab6e23bdbeeab719d8e4c49d63674876253',
            to: '0xb1690c08e213a35ed9bab7b318de14420fb57d8c',
            value: 320086793278069500,
            valueExactBase36: '2fjpaqu9o0tc',
            blockNumber: 5711193,
            timestamp: 1527814787,
            transactionHash: '0x1a06a3a86d2897741f3ddd774df060a63d626b01197c62015f404e1f007fa04d',
            transactionPosition: 0,
            type: 'call'
        } satisfies ETHTransfer;
        endOfBlock = endOfBlockEvent(5711193);
        feeResultWithPrimaryKey = v8.deserialize(v8.serialize(feeResult));
        feeResultWithPrimaryKey.primaryKey = 1;

        callResultWithPrimaryKey = v8.deserialize(v8.serialize(callResult));
        callResultWithPrimaryKey.primaryKey = 2;

        eobWithPrimaryKey = v8.deserialize(v8.serialize(endOfBlock));
        eobWithPrimaryKey.primaryKey = 3;

        blockInfos.set(5711191, ethBlockEvent(5711191))
        blockInfos.set(5711192, ethBlockEvent(5711192))
        blockInfos.set(5711193, ethBlockEvent(5711193))
    });



    it('test end of block events', async function () {
        worker.lastConfirmedBlock = 5711193;
        worker.lastExportedBlock = 5711190;
        worker.fetchData = async function () {
            return Promise.resolve([[], blockInfos, {}]);
        };
        worker.transformPastEvents = function () {
            return [feeResult, callResult];
        };

        const result = await worker.work();

        // input event is for block 5711193
        // last exported block 5711190
        // so there should be 3 EOB
        const blocks = result.map((value) => value.blockNumber);
        const types = result.map((value) => value.type);
        expect(blocks).toEqual([5711191, 5711192, 5711193, 5711193, 5711193]);
        expect(types).toEqual(["EOB", "EOB", "fee", "call", "EOB"]);
    })

});

function ethBlockEvent(blockNumber: number): ETHBlock {
    return {
        gasLimit: "0",
        gasUsed: "0",
        hash: "0",
        miner: "miner",
        number: blockNumber.toString(),
        timestamp: "0x55ba467c",
        totalDifficulty: "3",
        difficulty: "2",
        size: '2',
        transactions: []
    } satisfies ETHBlock
}

function endOfBlockEvent(blockNumber: number): EOB {
    return {
        from: "0x0000000000000000000000000000000000000000",
        to: "0x0000000000000000000000000000000000000000",
        value: 0,
        valueExactBase36: "0",
        blockNumber: blockNumber,
        timestamp: 1438271100,
        transactionHash: "0x0000000000000000000000000000000000000000",
        transactionPosition: 2147483647,
        type: "EOB"
    };
}
