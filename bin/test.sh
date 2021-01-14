#! /bin/sh

docker-compose -f ./docker/docker-compose-test.yaml build && \
docker-compose -f ./docker/docker-compose-test.yaml run test
