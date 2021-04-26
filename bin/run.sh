 #! /bin/sh

BLOCKCHAIN=eth docker-compose -f docker/docker-compose.yml up --build && docker-compose -f docker/docker-compose.yml rm -f
