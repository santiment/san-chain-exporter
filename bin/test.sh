#! /bin/sh

docker build --build-arg NODE_ENV=development -t erc20-transfers-exporter-test -f docker/Dockerfile .
echo "Docker run is run from $(pwd)"
docker run  -v $(pwd)/test/contract_mapping:/opt/app/lib/contract_mapping/ -t erc20-transfers-exporter-test npm test 
