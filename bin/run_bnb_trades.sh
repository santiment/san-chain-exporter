 #! /bin/sh
set -e

BLOCKCHAIN=bnb NODE_URL=https://dex.binance.org/api/v1/trades/ BNB_MODE=trades \
docker-compose -f docker/docker-compose.yaml up --build
docker-compose -f docker/docker-compose.yaml rm -f
