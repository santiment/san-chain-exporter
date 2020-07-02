#! /bin/sh

docker build --build-arg NODE_ENV=development -t erc20-transfers-exporter-test -f docker/Dockerfile . &&
docker run --rm -t erc20-transfers-exporter-test npm test