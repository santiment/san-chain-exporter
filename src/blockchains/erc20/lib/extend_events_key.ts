'use strict';

import { stableSort } from './util';
import * as constants from './constants';
import { logger } from '../../../lib/logger';
import { ERC20Transfer } from '../erc20_types';

function transactionOrder(a: ERC20Transfer, b: ERC20Transfer) {
  const blockDif = a.blockNumber - b.blockNumber;
  if (blockDif !== 0) {
    return blockDif;
  }
  else {
    const aTxIndex = typeof a.transactionIndex === 'number' ? a.transactionIndex : -1;
    const bTxIndex = typeof b.transactionIndex === 'number' ? b.transactionIndex : -1;
    const txIndexDiff = aTxIndex - bTxIndex;
    if (txIndexDiff !== 0) {
      return txIndexDiff;
    }
    return a.logIndex - b.logIndex;
  }
}

export function extendEventsWithPrimaryKey(events: ERC20Transfer[], overwritten_events: ERC20Transfer[] = []) {
  stableSort(events, transactionOrder);

  const lastLogIndexPerBlock: { [key: number]: number } = {};
  const overwrittenEventsCountPerBlock: { [key: number]: number } = {};

  overwritten_events.forEach(function (event) {
    overwrittenEventsCountPerBlock[event.blockNumber] = (overwrittenEventsCountPerBlock[event.blockNumber] || 0) + 1;
  });

  events.forEach(function (event) {
    event.primaryKey = event.blockNumber * constants.PRIMARY_KEY_MULTIPLIER + event.logIndex;
    const currentMax = lastLogIndexPerBlock[event.blockNumber];
    if (typeof currentMax !== 'number' || event.logIndex > currentMax) {
      lastLogIndexPerBlock[event.blockNumber] = event.logIndex;
    }
  });

  Object.entries(lastLogIndexPerBlock).forEach(([blockNumberRaw, maxLogIndex]) => {
    const blockNumber = Number(blockNumberRaw);
    const overwrittenCount = overwrittenEventsCountPerBlock[blockNumber] || 0;
    if (maxLogIndex + overwrittenCount >= constants.PRIMARY_KEY_MULTIPLIER) {
      logger.error(`An event with log index ${maxLogIndex} is breaking the primaryKey generation logic at block `
        + `${blockNumber}. There are ${overwrittenCount} overwritten events.`);
    }
  });

  // As the overwritten events are copies of the main events, they would have the same logIndex. To generate unique primary keys,
  // the primary keys of overwritten events start after the biggest primary key of the main events and increase by 1.
  overwritten_events.forEach(function (event) {
    const blockNumber = event.blockNumber;
    if (typeof lastLogIndexPerBlock[blockNumber] !== 'number') {
      lastLogIndexPerBlock[blockNumber] = -1;
    }
    lastLogIndexPerBlock[blockNumber] += 1;
    event.primaryKey = event.blockNumber * constants.PRIMARY_KEY_MULTIPLIER + lastLogIndexPerBlock[blockNumber];
  });
}
