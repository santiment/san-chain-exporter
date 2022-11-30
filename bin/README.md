# Run scripts for running the exporter

## Running inside Docker

You can run any of the blockchain specific scripts, which would bring up the exporter inside a Docker container.

## Running servers in Docker and exporter on host

Alternatively you can use `./bin/run_servers.sh` to bring up the Kafka and Zookeeper servers and then run the JS
script locally. This allows to easily debug the script from inside an IDE. Before running the script you may want to
export needed environment variables using `source ./bin/export_env_vars.sh`.

A VSCode debug example:
* In one terminal run `./bin/run_servers.sh`
* In another terminal - edit as needed and export variables with `source ./bin/export_env_vars.sh`.
* In the second terminal run `code .`, this would inherit the env variables. Open `index.js` and `Run Debug`, VSCode
should attach to the Node process. Note that this would not trigger the `micro` service which is the entrypoint of
`npm start`, this example presumes this is not part of the debug session.