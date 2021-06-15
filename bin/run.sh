 #! /bin/sh

BLOCKCHAIN=ETHWorker docker-compose -f docker/docker-compose.yml up --build && docker-compose -f docker/docker-compose.yml rm -f
