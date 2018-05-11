/* jslint es6 */
"use strict";
const { send } = require('micro')
const url = require('url')
const Web3 = require('web3')

const BLOCK_INTERVAL = parseInt(process.env.BLOCK_INTERVAL || "100")
let lastProcessedBlock = parseInt(process.env.START_BLOCK || "2000000")
const TRANSFER_EVENT_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

const PARITY_NODE = process.env.PARITY_URL || "http://localhost:8545/";
console.info(`Connecting to parity node ${PARITY_NODE}`)
let web3 = new Web3(new Web3.providers.HttpProvider(PARITY_NODE))

const KAFKA_URL = process.env.KAFKA_URL || "localhost:9092"
console.info(`Connecting to kafka host ${KAFKA_URL}`)
const kafka = require('kafka-node'),
    HighLevelProducer = kafka.HighLevelProducer,
    KeyedMessage = kafka.KeyedMessage,
    kafkaClient = new kafka.KafkaClient(KAFKA_URL),
    producer = new HighLevelProducer(kafkaClient)

const KAFKA_TOPIC = process.env.KAFKA_TOPIC || "erc20_transfers"
console.info(`Pushing data to topic ${KAFKA_TOPIC}`)

const decodeAddress = (value) => {
  return "0x" + value.substring(value.length - 40)
}

async function getBlockTimestamp(blockNumber) {
  const block = await web3.eth.getBlock(blockNumber)

  return block["timestamp"]
}

async function decodeEvent(event, blockTimestamps) {
  let timestamp;
  if (!blockTimestamps[event["blockNumber"]]) {
    timestamp = blockTimestamps[event["blockNumber"]] = await getBlockTimestamp(event["blockNumber"])
  } else {
    timestamp = blockTimestamps[event["blockNumber"]]
  }

  return new KeyedMessage(event["address"].toLowerCase(), JSON.stringify({
    from: decodeAddress(event["topics"][1]),
    to: decodeAddress(event["topics"][2]),
    value: web3.utils.hexToNumberString(event["data"]),
    contract: event["address"].toLowerCase(),
    blockNumber: event["blockNumber"],
    timestamp: timestamp
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
    result.push(await decodeEvent(events[i], blockTimestamps))
  }

  return result
}

function sendData(events) {
  return new Promise((resolve, reject) => {
    producer.send([{
      topic: KAFKA_TOPIC,
      messages: events,
      attributes: 1
    }], (err, data) => {
      if (err) return reject(err)
      resolve(data)
    })
  })
}

async function work() {
  const currentBlock = await web3.eth.getBlockNumber()
  console.info(`Fetching transfer events for interval ${lastProcessedBlock}:${currentBlock}`)

  while (lastProcessedBlock < currentBlock) {
    const toBlock = Math.min(lastProcessedBlock + BLOCK_INTERVAL, currentBlock)
    const events = await getPastEvents(lastProcessedBlock + 1, toBlock)

    if (events != []) {
      console.info(`Storing ${events.length} messages for blocks ${lastProcessedBlock + 1}:${toBlock}`)
      const result = await sendData(events)
    }

    lastProcessedBlock = toBlock
  }
}

const init = () => {
  // Execute the `work` every 30 sec after it has finished working
  work().then(() => {
    setTimeout(work, 30 * 1000)
  })
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
  }
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
