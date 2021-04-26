const assert = require("assert");
const { addGenesisTransfers } = require("../../blockchains/eth/lib/genesis_transfers")
const Web3 = require('web3')
const web3 = new Web3()

describe('genesis transfers', function() {
  it("adds all genesis transfers", function() {
    const transfers = []
    addGenesisTransfers(web3, transfers)

    assert.equal(transfers.length, 8894);
  });

  it("adds the reward transfer", function() {
    const transfers = []
    addGenesisTransfers(web3, transfers)

    const reward = transfers.find((t) => t.type == "reward")
    assert.equal(reward.value, "5000000000000000000")
  });

  it("adds the correct amount of ETH in circulation", function() {
    const transfers = []
    addGenesisTransfers(web3, transfers)

    const totalEth = transfers.reduce((a, t) => a + parseFloat(t.value) / 1e18, 0.0)

    assert.ok(Math.abs(totalEth - 72009995.49947993) < 0.000001)
  });

  it("adds genesis addresses in the corrent format", function() {
    const transfers = []
    addGenesisTransfers(web3, transfers)

    const transfer = transfers.find((t) => t.to == "0x17961d633bcf20a7b029a7d94b7df4da2ec5427f")

    assert.equal(transfer.value, "229427000000000000000")
    assert.equal(transfer.valueExactBase36, "1cf2u3xhgguq68")
  });
});
