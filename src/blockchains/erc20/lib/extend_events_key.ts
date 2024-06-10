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
    return a.logIndex - b.logIndex;
  }
}

export function extendEventsWithPrimaryKey(events: ERC20Transfer[], overwritten_events: ERC20Transfer[] = []) {
  stableSort(events, transactionOrder);
  const lastEvent = events[events.length - 1];
  if (lastEvent.logIndex + overwritten_events.length >= constants.PRIMARY_KEY_MULTIPLIER) {
    logger.error(`An event with log index ${lastEvent.logIndex} is breaking the primaryKey generation logic at block `
      + `${lastEvent.blockNumber}. There are ${overwritten_events.length} overwritten events.`);
  }

  // Store the last log index of the original events per block
  let lastLogIndexPerBlock: { [key: number]: number } = {};
  events.forEach(function (event) {
    event.primaryKey = event.blockNumber * constants.PRIMARY_KEY_MULTIPLIER + event.logIndex;
    // We depend on the events being sorted by log index above
    lastLogIndexPerBlock[event.blockNumber] = event.logIndex;
  });
  // As the overwritten events are copies of the main events, they would have the same logIndex. To generate unique primary keys,
  // the primary keys of overwritten events start after the biggest primary key of the main events and increase by 1.
  overwritten_events.forEach(function (event) {
    lastLogIndexPerBlock[event.blockNumber] += 1;
    event.primaryKey = event.blockNumber * constants.PRIMARY_KEY_MULTIPLIER + lastLogIndexPerBlock[event.blockNumber];
  });
}

