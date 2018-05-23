const decodeAddress = (value) => {
  return "0x" + value.substring(value.length - 40)
}

module.exports = {
  decodeAddress
}
