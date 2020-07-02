#! /bin/sh

docker-compose -f ./docker/test/docker-compose.yml build && \
docker-compose -f ./docker/test/docker-compose.yml run test