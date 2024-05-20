#! /bin/sh
set -e

docker build --build-arg BUILD_ENV=development -t san-chain-exporter-test -f docker/Dockerfile .
docker run --env BLOCKCHAIN=erc20 --rm -t san-chain-exporter-test npm test
