 #! /bin/sh
set -e

BLOCKCHAIN=erc20 NODE_URL=https://binance.santiment.net docker compose -f docker/docker-compose.yaml up --build
docker compose -f docker/docker-compose.yaml rm -f
