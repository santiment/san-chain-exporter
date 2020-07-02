
#! /bin/sh

docker-compose -f ./docker/test/docker-compose.yml down -v
docker-compose -f ./docker/development/docker-compose.yml down -v