 #! /bin/sh

docker-compose -f ./docker-compose.yml up --build && docker-compose rm -f
