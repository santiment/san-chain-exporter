# ERC20 Transfer Event Exporter

A small service that exports all ERC20 Transfer Events from the ethereum blockchain to a Kafka topic. It is written in javascript and uses the [web3.js](https://github.com/ethereum/web3.js/) library which implements the Ethereum JSON RPC spec.

## Run

You need to have access to a parity full node. By default in docker-compose `PARITY_URL` points to
the staging instance.

```bash
$ ./bin/run.sh
```

## Configure

You can configure the service with the following ENV variables:

* `PARITY_URL` - Parity node url. Default: `http://localhost:8545/`
* `START_BLOCK` - the block number from which to begin extracting the events. Default: `-1`
* `START_PRIMARY_KEY` - the block primary key from which to begin extracting the events. Default: `-1`
* `BLOCK_INTERVAL` - the number of blocks for which to fetch the events at once. Default: `1000`
* `CONFIRMATIONS` - **DESCRIBE**. Default: `3`
* `EXPORT_TIMEOUT_MLS` - max time interval between successful data pushing to kafka to treat the service as healthy.
Default: `1000 * 60 * 5, 5 minutes`

### Health checks

You can make health check GET requests to the service. The health check makes a request to Kafka to make sure the connection is not lost, try to request current block number of the blockchain and also checks time from the previous pushing data to kafka (or time of the service start if no data pushed yet):

```bash
curl http://localhost:3000/healthcheck
```

If the health check passes you get response code 200 and response message `ok`.
If the health check does not pass you get response code 500 and a message describing what failed.

## Tests

You can run the unit tests with:

```bash
$ ./bin/test.sh

You can run the integration tests with:
$ ./e2e/test.sh


```

## Custom contract events

The following contracts have been checked manually for custom events (most of the events aren't filtered by contract, so any contract that issues them will also be watched):

* BNB (0xB8c77482e45F1F44dE1745F52C74426C631bDD52)
   * Burn(address indexed,uint256)
   * Freeze(address indexed,uint256)
      * Implemented as sending to `freeze` address. Watched only for BNB
   * Unfreeze(address indexed,uint256)
      * Implemented as receiving from `freeze` address. Watched only for BNB
* MKR (0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2)
   * Mint(address indexed,uint256)
   * Burn(address indexed,uint256)
* OMG (0xd26114cd6EE289AccF82350c8d8487fedB8A0C07)
   * Mint(address indexed,uint256)
* USDC (0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48)
* VEN (0xd850942ef8811f2a866692a623011bde52a462c1)
* TUSD (0x0000000000085d4780B73119b644AE5ecd22b376)
* HOT (0x6c6ee5e31d828de241282b9606c8e98ea48526e2)
   * Mint(address indexed,uint256)
   * Burn(uint256)
      * Not implemented - only a specific address can burn, but we don't know it
* ZIL (0x05f4a42e251f2d52b8ed15e9fedaacfcef1fad27)
   * Burn(address indexed,uint256)
* LINK (0x514910771af9ca656af840dff83e8264ecf986ca)
* ZRX (0xe41d2489571d322189246dafa5ebde1f4699f498)
* BAT (0x0d8775f648430679a709e98d2b0cb6250d2887ef)
   * CreateBAT(address indexed,uint256)
* REP (0x1985365e9f78359a9B6AD760e32412f4a445E862)
* R (0x48f775efbe4f5ece6e0df2f7b5932df56823b990)
* SNT (0x744d70fdbe2ba4cf95131626614a1763df805b9e)
   * ClaimedTokens(address indexed,address indexed,uint256)
       * Not implemented - I don't know what they are for
   * TokensWithdrawn(address indexed,uint256)
       * Not implemented - I don't know what they are for
   * TokensCollected(address indexed,uint256)
       * Not implemented - I don't know what they are for
* GNT (0xa74476443119A942dE498590Fe1f2454d7D4aC0d)
* QNT (0x4a220e6096b25eadb88358cb44068a3248254675)
   * any tokens sent to contract's addresses are considered as burnt
* WETH (0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2)
   * Deposit(address,uint256)
   * Withdrawal(address,uint256)
