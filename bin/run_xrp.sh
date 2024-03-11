#! /bin/sh
set -e

BLOCKCHAIN=xrp docker compose -f docker/docker-compose.yaml up --build
docker compose -f docker/docker-compose.yaml rm -f
