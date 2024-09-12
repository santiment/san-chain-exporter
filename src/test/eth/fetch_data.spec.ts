import assert from 'assert';
import { parseEthInternalTrx } from '../../blockchains/eth/lib/fetch_data';
import * as constants from '../../blockchains/eth/lib/constants';
import { Trace } from '../../blockchains/eth/eth_types';


const nullActionTrace: any = {
    "action": null,
    "blockHash": "0xfebdb7331dcd410b90d3394b3f42f99b8df88134b1ffcf4589e2e08bbe5da5c0",
    "blockNumber": 16375524,
    "result": {
        "gasUsed": "0x0"
    },
    "subtraces": 0,
    "traceAddress": [
        0,
        2
    ],
    "transactionHash": "0x95d801b07418a591b94f6029831b73a73d534e00ea4e1effc3c30f00832dcf31",
    "transactionPosition": 75,
    "type": "call"
}

const preMergeTrace = {
    "action": {
        "from": "0x16893e10b99a59afd2c60331e0b49241d4d4d7cc",
        "callType": "call",
        "to": "0x91d050e1a0ee2423a35f2c7191f1c5405854ba99",
        "value": "0x1"
    },
    "blockHash": "0xf4590f903c395538fad33e8ce65e823083bbc49d6489fe84523b2e9a4acce713",
    "blockNumber": 81666,
    "result": {
        "gasUsed": "0xb6963",
    },
    "subtraces": 2,
    "traceAddress": [],
    "transactionHash": "0x6a53357416176c8e954330fbff34be32ccd078825e9610f2faca603f28e3cdeb",
    "transactionPosition": 0,
    "type": "reward"
};

const postMergeRewardTrace = {
    "action": {
        "from": "0x16893e10b99a59afd2c60331e0b49241d4d4d7cc",
        "callType": "call",
        "to": "0x91d050e1a0ee2423a35f2c7191f1c5405854ba99",
        "value": "0x1"
    },
    "blockHash": "0xf4590f903c395538fad33e8ce65e823083bbc49d6489fe84523b2e9a4acce713",
    "blockNumber": constants.THE_MERGE,
    "result": {
        "gasUsed": "0xb6963",
    },
    "subtraces": 2,
    "traceAddress": [],
    "transactionHash": "0x6a53357416176c8e954330fbff34be32ccd078825e9610f2faca603f28e3cdeb",
    "transactionPosition": 0,
    "type": "reward"
};

const postMergeNonRewardTrace = {
    "action": {
        "from": "0x16893e10b99a59afd2c60331e0b49241d4d4d7cc",
        "callType": "call",
        "to": "0x91d050e1a0ee2423a35f2c7191f1c5405854ba99",
        "value": "0x1"
    },
    "blockHash": "0xf4590f903c395538fad33e8ce65e823083bbc49d6489fe84523b2e9a4acce713",
    "blockNumber": constants.THE_MERGE,
    "result": {
        "gasUsed": "0xb6963",
    },
    "subtraces": 2,
    "traceAddress": [],
    "transactionHash": "0x6a53357416176c8e954330fbff34be32ccd078825e9610f2faca603f28e3cdeb",
    "transactionPosition": 0,
    "type": "call"
};

describe('Test that when action is null parsing would not break', function () {
    it('Null action should not break parsing', function () {
        const result = parseEthInternalTrx([nullActionTrace as Trace], true, constants.THE_MERGE);

        assert.deepStrictEqual(result, []);
    });

    it('Reward trace after "The Merge" is filtered', function () {
        const result = parseEthInternalTrx([preMergeTrace, postMergeNonRewardTrace, postMergeRewardTrace], true,
            constants.THE_MERGE);

        assert.deepStrictEqual(result, [preMergeTrace, postMergeNonRewardTrace]);
    });


});
