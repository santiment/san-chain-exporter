#! /bin/bash

# This script would bring up Kafka and Zookeeper to allow running the exporter locally. To stop it press "Ctrl+C".
# We are registering a signal handler so we can remove the docker containers. This is needed so that Zookeeper
# container would not remember progress between runs. Instead env variable 'START_BLOCK' would be used.

function handler() {
  echo "Cleaning docker containers"
  docker compose -f docker/docker-compose-servers.yaml rm -f
}

# On Ctrl+C do a cleanup of the docker containers
trap handler SIGINT

BLOCKCHAIN=eth docker compose -f docker/docker-compose-servers.yaml up --build
