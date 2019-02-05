# ERC20 Transfer Event Exporter

A small service that exports all ERC20 Transfer Events from the ethereum blockchain to a Kafka topic. It is written in javascript and uses the https://github.com/ethereum/web3.js/ library which implements the Ethereum JSON RPC spec.

## Setup

You need to have access to a parity full node to run this. The easiest way to get access to one is to
use the parity service we have on staging. You need to setup kubernetes access to the staging k8s cluster.
Then you need to run a proxy to it, like this:

```bash
$ kubectl proxy --address '0.0.0.0' --accept-hosts='^.*'
```

After that you can access the parity service using the IP of your machine in the current network, like
this:

```bash
$ curl --data '{"method":"trace_filter","params":[{"fromBlock":"0x34147D","toBlock":"0x34147D"}],"id":1,"jsonrpc":"2.0"}' -H "Content-Type: application/json" -X POST http://<YOUR_IP>:8001/api/v1/namespaces/default/services/parity-optimized:8545/proxy/
```

You can use the URL `http://<YOUR_IP>:8001/api/v1/namespaces/default/services/parity-optimized:8545/proxy/`
as the `PARITY_URL` in the `docker-compose.yml` file.

## Running the service

The easiest way to run the service is using `docker-compose`:

Example:

```bash
$ docker-compose up --build
```

You need to tweak the URL to the parity service in the `docker-compose.yml`. See the `Setup` section
for more details.

## Running the tests

You can run the tests with:

```bash
$ docker build -f Dockerfile-test -t erc20-transfers-exporter-tests .
$ docker run -it erc20-transfers-exporter-tests
```

## Custom contract events events

The following contracts have been checked manually for custom events (most of the events aren't filtered by contract, so any contract that issues them will also be watched):

* BNB (0xB8c77482e45F1F44dE1745F52C74426C631bDD52)
   * Burn(address indexed,uint256)
   * Freeze(address indexed,uint256)
      * Implemented as burning. Watched only for BNB
   * Unfreeze(address indexed,uint256)
      * Implemented as minting. Watched only for BNB
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
* REP (0x1985365e9f78359a9B6AD760e32412f4a445E862)
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
