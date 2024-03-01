#! /bin/sh
set -e

BLOCKCHAIN=receipts NODE_URL=https://ethereum-backup.santiment.net docker compose -f docker/docker-compose.yaml up --build
docker compose -f docker/docker-compose.yaml rm -f
