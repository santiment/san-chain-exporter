#! /bin/sh
set -e

BLOCKCHAIN=eth_beacon BEACON_API=https://ethereum-beacon.santiment.net docker compose -f docker/docker-compose.yaml up --build
docker compose -f docker/docker-compose.yaml rm -f
