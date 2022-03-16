 #! /bin/sh

BLOCKCHAIN=utxo docker-compose -f docker/docker-compose.yaml up --build && docker-compose -f docker/docker-compose.yaml rm -f
