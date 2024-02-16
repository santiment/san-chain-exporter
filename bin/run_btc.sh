 #! /bin/sh

BLOCKCHAIN=utxo NODE_URL=https://bitcoin.santiment.net docker compose -f docker/docker-compose.yaml up --build && docker compose -f docker/docker-compose.yaml rm -f
