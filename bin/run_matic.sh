#! /bin/sh
set -e

BLOCKCHAIN=matic docker-compose -f docker/docker-compose.yaml up --build
docker-compose -f docker/docker-compose.yaml rm -f
