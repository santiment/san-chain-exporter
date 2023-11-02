# Fetch Blocks List
---
## Description
This functionality enables the user to fetch CSV data, given via a ConfigMap through the deploy, it being in the following format:
```
1
2
5
10
...
```
After the CSV data is downloaded, it's inserted into an array.

## How it works

0. Make sure you've setup your environment and the following constants
```
EXPORT_BLOCKS_LIST
EXPORT_BLOCKS_LIST_MAX_INTERVAL
```
1. If the switch is "on" for exporting a list of blocks, and we've given it the corresponding env variables, 
the data gets read from the csv file and gets put into an array
2. Build the appropriate intervals of blocks from the blocks in the array
3. Iterate through this array, keeping the position for it. If the pod gets restarted, find the position for the interval with the last processed block (this is mainly made for usage with the ERC20 pipeline, haven't implemented this for other BCs)

## Why is this needed?
Blockchain nodes contain tons of information, but sometimes all you need is data for a fraction of the blocks in the node

## Tests

To run the tests for this class' functionality, run the following command

```bash
npm test test/lib/fetch_blocks_list.spec.js
```
