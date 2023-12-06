export KAFKA_URL=kafka-hz.stage.san:30911
export ZOOKEEPER_URL=zookeeper-hz.stage.san:30921
export NODE_URL=https://ethereum.santiment.net
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
export CARDANO_GRAPHQL_URL=https://cardano.santiment.net
export BNB_CHAIN_START_MSEC=1595549200002
export ZOOKEEPER_SESSION_TIMEOUT=20000
export CONTRACT_MAPPING_FILE_PATH="./test/erc20/contract_mapping/contract_mapping.json"
