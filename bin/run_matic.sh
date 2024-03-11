#! /bin/sh
set -e

BLOCKCHAIN=matic NODE_URL=https://polygon.santiment.net docker compose -f docker/docker-compose.yaml up --build
docker compose -f docker/docker-compose.yaml rm -f
