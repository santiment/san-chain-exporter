/*jshint esversion: 6 */
const fs = require('fs');
const Web3 = require('web3');
const web3 = new Web3();
const path = require('path');

const MINT_ADDRESS = 'mint';
const BURN_ADDRESS = 'burn';

// The files should be csv with columns: sign, address, amount
// sign = 1 - minting; sign = -1 - burning
// !!! If you change the order of the elements in the array (or inside a file) the transfers primary keys will change
const customTransfersData = [
    {
        blockNumber: 4011221,
        timestamp: 1499846591,
        contract: '0x7c5a0ce9267ed19b22f8cae653f198e3e8daf098',
        file: 'san_presale.csv',
        transactionHashPrefix: 'SAN_PRESALE'
    }
];

// Log index fields are important for us as they form the primary key of exported Kafka records.
// Return here the last 'real world' value seen in a transfer.
function getLastRealLogIndexForBlock(transfers, blockNumber) {
    let lastLogIndex = 0;

    transfers.forEach((transfer) => {
        if( transfer.blockNumber == blockNumber && transfer.logIndex > lastLogIndex) {
            lastLogIndex = transfer.logIndex;
        }
    });

    return lastLogIndex;
}

function addTransfers(transfers, transfersData) {
    let addressBalances = fs.readFileSync(path.resolve(__dirname) + '/' + transfersData.file, {encoding: 'utf8'})
        .split('\n')
        .filter((line) => line != 0)
        .map((line) => line.split(',').map((element) => element.trim()));

    // Starting from last real value reached, increment on every newly generated transfer
    let logIndexReached = getLastRealLogIndexForBlock(transfers, transfersData.blockNumber);

    addressBalances.forEach((transfer) => {
        const [sign, address, amount] = transfer;

        if (amount <= 0) {
            return;
        }

        let from = null;
        let to = null;
        let transactionHash = null;
        if(sign > 0) {
            from = MINT_ADDRESS;
            to = address;
            transactionHash = transfersData.transactionHashPrefix+'_'+MINT_ADDRESS+'_'+address;
        }
        else if (sign < 0) {
            from = address;
            to = BURN_ADDRESS;
            transactionHash = transfersData.transactionHashPrefix+'_'+BURN_ADDRESS+'_'+address;
        }
        else {
            return;
        }

        ++logIndexReached;

        transfers.push({
            contract: transfersData.contract,
            blockNumber: transfersData.blockNumber,
            timestamp: transfersData.timestamp,
            transactionHash: transactionHash,
            logIndex: logIndexReached,
            from: from,
            to: to,
            value: amount,
            valueExactBase36: web3.utils.toBN(amount).toString(36)
        });
    });
}

exports.addCustomTokenDistribution = function(transfers, fromBlock, toBlock, contract) {
    customTransfersData.forEach((transfersData) => {
        if(transfersData.blockNumber >= fromBlock && transfersData.blockNumber <= toBlock && (null == contract || transfersData.contract == contract)) {
            addTransfers(transfers, transfersData);
        }
    });
};