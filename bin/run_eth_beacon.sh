#! /bin/sh
set -e

BLOCKCHAIN=eth_beacon NODE_URL=https://ethereum-beacon.santiment.net docker compose -f docker/docker-compose.yaml up --build
docker compose -f docker/docker-compose.yaml rm -f
