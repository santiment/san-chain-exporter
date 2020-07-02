#! /bin/sh

# Wait for Kafka
until nc -z -v -w30 kafka 9092
do
  echo 'Waiting for Kafka...'
  sleep 1
done

echo "Kafka is up and running"