 #! /bin/sh

BLOCKCHAIN=erc20 docker-compose -f docker/docker-compose.yml up --build && docker-compose -f docker/docker-compose.yml rm -f
