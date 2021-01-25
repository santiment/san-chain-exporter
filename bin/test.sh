#! /bin/sh

docker build --build-arg NODE_ENV=development -t erc20-transfers-exporter-test -f docker/Dockerfile-test .
docker run --rm -t erc20-transfers-exporter-test
