 #! /bin/sh

BLOCKCHAIN=bnb NODE_URL=https://explorer.binance.org/api/v1/ docker-compose -f docker/docker-compose.yaml up --build && docker-compose -f docker/docker-compose.yaml rm -f
