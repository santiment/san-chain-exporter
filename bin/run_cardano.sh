#! /bin/sh
set -e

BLOCKCHAIN=cardano docker compose -f docker/docker-compose.yaml up --build
docker compose -f docker/docker-compose.yaml rm -f
