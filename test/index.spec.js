const exporter = require("../index");

describe('decodeAddress', function() {
  it("decodes the addresses in the events correctly", async function() {
    expect(exporter.decodeAddress("0x000000000000000002c7536E3605D9C16a7a3D7b1898e529396a65c23")).to.equal("0x2c7536E3605D9C16a7a3D7b1898e529396a65c23");
  });
});
