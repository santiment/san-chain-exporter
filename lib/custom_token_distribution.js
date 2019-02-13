const fs = require('fs')
const Web3 = require('web3')
const web3 = new Web3()

const MINT_ADDRESS = "mint"
const BURN_ADDRESS = "burn"

// The files should be csv with columns: sign, address, amount
// sign = 1 - minting; sign = -1 - burning
// !!! If you change the order of the elements in the array (or inside a file) the transfers primary keys will change
const customTransfersData = [
    {
        blockNumber: 4011221,
        timestamp: 1499846591,
        contract: "0x7c5a0ce9267ed19b22f8cae653f198e3e8daf098",
        file: "lib/san_presale.csv",
        transactionHashPrefix: "SAN_PRESALE"
    }
]

function addTransfers(transfers, transfersData) {
    let addressBalances = fs.readFileSync(transfersData.file, {encoding: "utf8"})
        .split("\n")
        .filter((line) => line != 0)
        .map((line) => line.split(",").map((element) => element.trim()))

    addressBalances.forEach((transfer) => {
        const [sign, address, amount] = transfer

        if (amount <= 0) {
            return
        }

        let from = null
        let to = null
        let transactionHash = null
        if(sign > 0) {
            from = MINT_ADDRESS
            to = address
            transactionHash = transfersData.transactionHashPrefix+"_"+MINT_ADDRESS+"_"+address
        }
        else if (sign < 0) {
            from = address
            to = BURN_ADDRESS
            transactionHash = transfersData.transactionHashPrefix+"_"+BURN_ADDRESS+"_"+address
        }
        else {
            return
        }

        transfers.push({
            contract: transfersData.contract,
            blockNumber: transfersData.blockNumber,
            timestamp: transfersData.timestamp,
            transactionHash: transactionHash,
            logIndex: 0,
            from: from,
            to: to,
            value: amount,
            valueExactBase36: web3.utils.toBN(amount).toString(36)
        })
    })
}

exports.addCustomTokenDistribution = function(transfers, fromBlock, toBlock) {
    customTransfersData.forEach((transfersData) => {
        if(transfersData.blockNumber >= fromBlock && transfersData.blockNumber <= toBlock) {
            addTransfers(transfers, transfersData)
        }
    })
}