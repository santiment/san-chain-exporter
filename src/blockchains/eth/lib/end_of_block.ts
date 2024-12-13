import { ETHBlock, ETHTransfer } from "../eth_types";
import { Web3Interface, safeCastToNumber } from "./web3_wrapper";


// returns array of EOBs for the range of blocks
// from - inclusive, to - exclusive
export const collectEndOfBlocks = (from: number, to: number, blockInfos: Map<number, ETHBlock>, web3Wrapper: Web3Interface): ETHTransfer[] => {
    return range(from, to, 1).map((blockNumber) => {
        return {
            from: "0x0000000000000000000000000000000000000000",
            to: "0x0000000000000000000000000000000000000000",
            value: 0,
            valueExactBase36: "0",
            blockNumber: blockNumber,
            timestamp: safeCastToNumber(web3Wrapper.parseHexToNumber(blockInfos.get(blockNumber)!!.timestamp)),
            transactionHash: "0x0000000000000000000000000000000000000000",
            transactionPosition: maxTxPosition,
            internalTransactionPosition: 0,
            type: "EOB"
        }
    })
}

const maxTxPosition = Math.pow(2, 31) - 1 // max int32
// from - inclusive, to - exclusive
const range = (from: number, to: number, step: number) =>
    [...Array(Math.floor((to - from) / step) + 1)].map((_, i) => from + i * step);
