import assert from 'assert';
import { AddressContract, breakNeededBalancesPerBatch, ValueSet } from '../../blockchains/erc20/lib/balance_utils';

describe('test breakNeededBalancesPerBatch', function () {
  it('break correctly per batch size', async function () {

    const addressContract1: AddressContract = ['0x000001', 'AAA']
    const addressContract2: AddressContract = ['0x000002', 'AAA']
    const addressContract3: AddressContract = ['0x000003', 'BBB']
    const addressContract4: AddressContract = ['0x000004', 'BBB']
    const addressContract5: AddressContract = ['0x000005', 'BBB']
    const addresses = [addressContract1, addressContract2, addressContract3, addressContract4, addressContract5]
    const result = breakNeededBalancesPerBatch(addresses, 2)

    assert.deepStrictEqual(result, [[addressContract1, addressContract2], [addressContract3, addressContract4],
    [addressContract5]])
  });

  it('small list does not need breaking', async function () {

    const addressContract1: AddressContract = ['0x000001', 'AAA']
    const addressContract2: AddressContract = ['0x000002', 'BBB']
    const result = breakNeededBalancesPerBatch([addressContract1, addressContract2], 3)

    assert.deepStrictEqual(result, [[addressContract1, addressContract2]])
  });
});

describe('test ValueSet', function () {
  it('test different are added', async function () {

    const testedSet = new ValueSet

    const addressContract1: AddressContract = ['0x000001', 'AAA']
    const addressContract2: AddressContract = ['0x000002', 'BBB']

    testedSet.add(addressContract1)
    testedSet.add(addressContract2)

    assert.deepStrictEqual(testedSet.values(), [addressContract1, addressContract2])
  });

  it('test same is added only once', async function () {

    const testedSet = new ValueSet

    const addressContract1: AddressContract = ['0x000001', 'AAA']
    const addressContract2: AddressContract = ['0x000001', 'AAA']

    testedSet.add(addressContract1)
    testedSet.add(addressContract2)

    assert.deepStrictEqual(testedSet.values(), [addressContract1])
  });
});
