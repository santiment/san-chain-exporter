const assert = require("assert")
const { decodeAddress } = require("../../blockchains/erc20/lib/util")

describe('decodeAddress', function() {
  it("decodes the addresses in the events correctly", async function() {
    assert.equal(
      decodeAddress("0x000000000000000002c7536E3605D9C16a7a3D7b1898e529396a65c23"),
      "0x2c7536E3605D9C16a7a3D7b1898e529396a65c23"
    )
  })
})
