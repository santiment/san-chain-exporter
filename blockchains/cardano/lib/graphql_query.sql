{
    transactions(
      where: {
        block: { epoch: { number: { _is_null: false } } }
        _and: { block: { number: { _gt: ${lastProcessedPosition.blockNumber} } } }
      }
      order_by: { includedAt: asc }
    ) {
      includedAt
      blockIndex
      fee
      hash

      block {
        number
        epochNo
      }

      inputs {
        address
        value
      }
  
      outputs {
        address
        value
      }

    }
  }
