/* jslint es6 */
"use strict";
const pkg = require('./package.json');
const { send } = require('micro')
const url = require('url')
const Web3 = require('web3')
const zk = require('node-zookeeper-client-async')
const { decodeAddress } = require('./lib/util')

const BLOCK_INTERVAL = parseInt(process.env.BLOCK_INTERVAL || "100")
const KAFKA_MAX_EVENTS_TO_SENT = parseInt(process.env.KAFKA_MAX_EVENTS_TO_SENT || "10000")
const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || "3")
const TRANSFER_EVENT_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

const PARITY_NODE = process.env.PARITY_URL || "http://localhost:8545/";
console.info(`Connecting to parity node ${PARITY_NODE}`)
let web3 = new Web3(new Web3.providers.HttpProvider(PARITY_NODE))

const KAFKA_URL = process.env.KAFKA_URL || "localhost:9092"
console.info(`Connecting to kafka host ${KAFKA_URL}`)
const kafka = require('kafka-node'),
    HighLevelProducer = kafka.HighLevelProducer,
    KeyedMessage = kafka.KeyedMessage,
    ConsumerGroup = kafka.ConsumerGroup,
    kafkaClient = new kafka.KafkaClient({kafkaHost: KAFKA_URL}),
    producer = new HighLevelProducer(kafkaClient)

const KAFKA_TOPIC = process.env.KAFKA_TOPIC || "erc20_transfers"
console.info(`Pushing data to topic ${KAFKA_TOPIC}`)

const ZOOKEEPER_URL = process.env.ZOOKEEPER_URL || "localhost:2181"
console.log(`Connecting to zookeeper host ${ZOOKEEPER_URL}`)
const zookeeperClient = zk.createAsyncClient(ZOOKEEPER_URL)
const ZOOKEEPER_BLOCK_NUMBER_NODE = `/${pkg.name}/${KAFKA_TOPIC}/block-number`

let lastProcessedBlock = parseInt(process.env.START_BLOCK || "2000000")

async function getBlockTimestamp(blockNumber) {
  const block = await web3.eth.getBlock(blockNumber)

  return block["timestamp"]
}

async function decodeEvent(event, blockTimestamps) {
  if (!event["topics"][1] || !event["topics"][2]) {
    return null
  }

  let timestamp
  if (!blockTimestamps[event["blockNumber"]]) {
    timestamp = blockTimestamps[event["blockNumber"]] = await getBlockTimestamp(event["blockNumber"])
  } else {
    timestamp = blockTimestamps[event["blockNumber"]]
  }

  return new KeyedMessage(event["address"].toLowerCase(), JSON.stringify({
    from: decodeAddress(event["topics"][1]),
    to: decodeAddress(event["topics"][2]),
    value: parseFloat(web3.utils.hexToNumberString(event["data"])),
    contract: event["address"].toLowerCase(),
    blockNumber: parseInt(web3.utils.hexToNumberString(event["blockNumber"])),
    timestamp: timestamp,
    logIndex: web3.utils.hexToNumberString(event["logIndex"])
  }))
}

async function getPastEvents(fromBlock, toBlock) {
  const blockTimestamps = {}

  const events = await web3.eth.getPastLogs({
    fromBlock: web3.utils.numberToHex(fromBlock),
    toBlock: web3.utils.numberToHex(toBlock),
    topics: [TRANSFER_EVENT_TOPIC]
  })

  const result = []
  for (let i = 0;i < events.length; i++) {
    const decodedEvent = await decodeEvent(events[i], blockTimestamps)

    if (decodedEvent) result.push(decodedEvent)
  }

  return result
}

async function sendData(events) {
  for (let i = 0; i < events.length;i += KAFKA_MAX_EVENTS_TO_SENT) {
    await new Promise((resolve, reject) => {
      producer.send([{
        topic: KAFKA_TOPIC,
        messages: events.slice(i, i + KAFKA_MAX_EVENTS_TO_SENT),
        attributes: 1
      }], (err, data) => {
        if (err) return reject(err)
        resolve(data)
      })
    });
  }

  return true;
}

const saveLastProcessesBlock = () => {
  const newNodeValue = Buffer.alloc(4)
  newNodeValue.writeUInt32BE(lastProcessedBlock)

  return zookeeperClient.setDataAsync(ZOOKEEPER_BLOCK_NUMBER_NODE, newNodeValue)
}

async function work() {
  const currentBlock = await web3.eth.getBlockNumber() - CONFIRMATIONS
  console.info(`Fetching transfer events for interval ${lastProcessedBlock}:${currentBlock}`)

  while (lastProcessedBlock < currentBlock) {
    const toBlock = Math.min(lastProcessedBlock + BLOCK_INTERVAL, currentBlock)
    const events = await getPastEvents(lastProcessedBlock + 1, toBlock)

    if (events.length > 0) {
      console.info(`Storing ${events.length} messages for blocks ${lastProcessedBlock + 1}:${toBlock}`)
      await sendData(events)
    }

    lastProcessedBlock = toBlock
    await saveLastProcessesBlock()
  }
}

const fetchEvents = () => {
  work()
  .then(() => {
    console.log(`Progressed to block ${lastProcessedBlock}`)

    // Look for new events every 30 sec
    setTimeout(fetchEvents, 30 * 1000)
  })
}

async function fetchLastImportedBlock() {
  await zookeeperClient.connectAsync()
  console.info("Successfully connected to zookeeper")

  if (await zookeeperClient.existsAsync(ZOOKEEPER_BLOCK_NUMBER_NODE)) {
    const previousBlockNumber = await zookeeperClient.getDataAsync(ZOOKEEPER_BLOCK_NUMBER_NODE)
    lastProcessedBlock = previousBlockNumber.data.readUInt32BE(0)
    console.info(`Resuming export from block ${lastProcessedBlock}`)
  } else {
    const initialNodeValue = Buffer.alloc(4)
    initialNodeValue.writeUInt32BE(lastProcessedBlock)
    await zookeeperClient.mkdirpAsync(ZOOKEEPER_BLOCK_NUMBER_NODE, initialNodeValue)
    console.info(`Initialized node ${ZOOKEEPER_BLOCK_NUMBER_NODE} with value ${lastProcessedBlock}`)
  }
}

function init() {
  fetchLastImportedBlock()
  fetchEvents()
}

producer.on("ready", init)

//======================================================
const healthcheckParity = () => {
  return web3.eth.getBlockNumber()
}

const healthcheckKafka = () => {
  return new Promise((resolve, reject) => {
    if (kafkaClient.brokers.length > 0) {
      resolve()
    } else {
      reject("Kafka client is not connected to any brokers")
    }
  })
}

module.exports = async (request, response) => {
  const req = url.parse(request.url, true);
  const q = req.query;

  switch (req.pathname) {
    case '/healthcheck':
      return healthcheckKafka()
        .then(healthcheckParity())
        .then(() => send(response, 200, "ok"))
        .catch((err) => send(response, 500, `Connection to kafka or parity failed: ${err}`))

    default:
      return send(response, 404, 'Not found');
  }
}
