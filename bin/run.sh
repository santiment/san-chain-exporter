 #! /bin/sh

docker-compose -f docker/docker-compose.yml up --build && docker-compose -f docker/docker-compose.yml rm -f
