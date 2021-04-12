 #! /bin/sh

docker-compose -f ./e2e/docker-compose.yml up --build && docker-compose -f ./e2e/docker-compose.yml rm -f
