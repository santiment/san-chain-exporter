export KAFKA_URL=localhost:9092
export ZOOKEEPER_URL=localhost:2181
export NODE_URL=http://erigon-hz.stage.san:30250
export START_BLOCK="15676731"
export BLOCK_INTERVAL="50"
export EXPORT_TIMEOUT_MLS=300000
export CONTRACT_MODE="extract_exact_overwrite"
export BLOCKCHAIN="eth"
export KAFKA_TOPIC="erc20_exporter_test_topic"
# If testing locally you may need to expose Kubectl service like so:
# 'kubectl -n cardano port-forward cardano-graphql-pod-id --address 172.17.0.1 3100:3100'
# replacing with the actual pod id. The IP on which the container can access the host is
# usually 172.17.0.1
export CARDANO_GRAPHQL_URL=http://172.17.0.1:3100/graphql
export BNB_CHAIN_START_MSEC=1595549200002
export ZOOKEEPER_SESSION_TIMEOUT=20000
