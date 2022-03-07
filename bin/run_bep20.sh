 #! /bin/sh

BLOCKCHAIN=erc20 docker-compose -f docker/docker-compose.yaml up --build && docker-compose -f docker/docker-compose.yaml rm -f
