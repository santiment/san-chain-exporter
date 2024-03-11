# Matic Transfer Event Exporter

A small service that exports all Matic Transfers from the ethereum blockchain to a Kafka topic. It is written in javascript and uses ![web3.js](https://github.com/ethereum/web3.js/) library which implements the Polygon JSON RPC spec.

We are benefiting from UTXO-like event logs called LogTransfer, for more information look ![here](https://ethresear.ch/t/account-based-plasma-morevp/5480).

## Running the service

To test that the exporter is running correctly use:

```bash
$ ./bin/run_matic.sh
```

## Running the tests

TODO: Extend tests with decode LogTransfer.

```bash
$ ./bin/test.sh
```
