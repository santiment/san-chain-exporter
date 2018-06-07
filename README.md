# ERC20 Transfer Event Exporter

A small service that exports all ERC20 Transfer Events from the ethereum blockchain to a Kafka topic. It is written in javascript and uses ![web3.js](https://github.com/ethereum/web3.js/) library which implements the Ethereum JSON RPC spec.

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
