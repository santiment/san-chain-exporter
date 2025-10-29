import fs from 'fs';
import path from 'path';

const MINT_ADDRESS = 'mint';
const BURN_ADDRESS = 'burn';

type CustomTransferConfig = {
  blockNumber: number;
  timestamp: number;
  contract: string;
  file: string;
  transactionHashPrefix: string;
};

// The files should be csv with columns: sign, address, amount
// sign = 1 - minting; sign = -1 - burning
// !!! If you change the order of the elements in the array (or inside a file) the transfers primary keys will change
const customTransfersData: CustomTransferConfig[] = [
  {
    blockNumber: 4011221,
    timestamp: 1499846591,
    contract: '0x7c5a0ce9267ed19b22f8cae653f198e3e8daf098',
    file: 'san_presale.csv',
    transactionHashPrefix: 'SAN_PRESALE'
  }
];

type TransferRecord = {
  blockNumber: number;
  logIndex: number;
  contract: string;
  timestamp: number;
  transactionHash: string;
  from: string;
  to: string;
  value: bigint;
  valueExactBase36: string;
  [key: string]: unknown;
};

// Log index fields are important for us as they form the primary key of exported Kafka records.
// Return here the last 'real world' value seen in a transfer.
function getLastRealLogIndexForBlock(transfers: TransferRecord[], blockNumber: number): number {
  let lastLogIndex = 0;

  transfers.forEach((transfer) => {
    if (transfer.blockNumber === blockNumber && transfer.logIndex > lastLogIndex) {
      lastLogIndex = transfer.logIndex;
    }
  });

  return lastLogIndex;
}

function addTransfers(transfers: TransferRecord[], transfersData: CustomTransferConfig): void {
  const fileContent = fs.readFileSync(path.resolve(__dirname, transfersData.file), { encoding: 'utf8' });
  const addressBalances = fileContent
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(',').map((element) => element.trim()))
    .filter((parts) => parts.length >= 3);

  // Starting from last real value reached, increment on every newly generated transfer
  let logIndexReached = getLastRealLogIndexForBlock(transfers, transfersData.blockNumber);

  for (const transfer of addressBalances) {
    const [signRaw, address, amountRaw] = transfer;
    if (!address) {
      continue;
    }

    const sign = Number(signRaw);
    if (!Number.isFinite(sign) || !Number.isInteger(sign) || sign === 0) {
      continue;
    }

    const amountString = amountRaw.replace(/\s+/g, '');
    if (!/^-?\d+$/.test(amountString)) {
      continue;
    }

    const amount = BigInt(amountString);
    if (amount <= 0n) {
      continue;
    }

    let from: string;
    let to: string;
    let transactionHash: string;
    if (sign > 0) {
      from = MINT_ADDRESS;
      to = address;
      transactionHash = `${transfersData.transactionHashPrefix}_${MINT_ADDRESS}_${address}`;
    }
    else if (sign < 0) {
      from = address;
      to = BURN_ADDRESS;
      transactionHash = `${transfersData.transactionHashPrefix}_${BURN_ADDRESS}_${address}`;
    }
    else {
      continue;
    }

    ++logIndexReached;

    transfers.push({
      contract: transfersData.contract,
      blockNumber: transfersData.blockNumber,
      timestamp: transfersData.timestamp,
      transactionHash,
      logIndex: logIndexReached,
      from,
      to,
      value: amount,
      valueExactBase36: amount.toString(36)
    });
  }
}

export function addCustomTokenDistribution(
  transfers: TransferRecord[],
  fromBlock: number,
  toBlock: number,
  contract: string | string[] | null
): void {
  if (!contract) {
    return;
  }
  customTransfersData.forEach((transfersData) => {
    const matchesContract = Array.isArray(contract)
      ? contract.includes(transfersData.contract)
      : transfersData.contract === contract;
    if (
      transfersData.blockNumber >= fromBlock &&
      transfersData.blockNumber <= toBlock &&
      matchesContract
    ) {
      addTransfers(transfers, transfersData);
    }
  });
}
