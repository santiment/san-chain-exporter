const assert = require("assert")
const { TimestampsManager} = require("../../blockchains/erc20/lib/./timestamps_manager")

class ExporterMock {
  constructor() {
    this.exports = {}
  }

  getLastBlockTimestamp() {
        const result = {}
        result.blockNumber = 100
        result.timestamp = 1000

        return result
  }
  saveLastBlockTimestamp() {
    return true
  }
}

describe('Test Timestamps manger', function() {
    it("test load timestamps from ZK", async function () {
        const timestampsManager = new TimestampsManager()
        await timestampsManager.init(new ExporterMock(true))

        const lastTimestampUsed = {}
        lastTimestampUsed.blockNumber = 100
        lastTimestampUsed.timestamp = 1000

        assert.deepStrictEqual(timestampsManager.lastTimestampUsed, lastTimestampUsed)
    })

    it("test increase timestamp", async function () {
        const timestampsManager = new TimestampsManager()
        await timestampsManager.init(new ExporterMock(true))

        assert.deepStrictEqual(timestampsManager.increaseTimestampIfNeed(999), 1001)
    })

    it("test existing block does not reach node", async function () {
        const timestampsManager = new TimestampsManager()
        await timestampsManager.init(new ExporterMock(true))

        assert.deepStrictEqual(await timestampsManager.getBlockTimestamp(null, 100), 1000)
    })

    it("test correct full loop", async function () {
        const timestampsManager = new TimestampsManager()
        await timestampsManager.init(new ExporterMock(true))

        timestampsManager.getTimestampFromNode = async function() {
            return 999
        }

        assert.deepStrictEqual(await timestampsManager.getBlockTimestamp(null, 101), 1001)
    })


})
