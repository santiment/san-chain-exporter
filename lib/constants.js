const EXPORT_TIMEOUT_MLS = parseInt(process.env.EXPORT_TIMEOUT_MLS || 1000 * 60 * 5)     // 5 minutes
// A custom versioning we add to the output data
const SAN_VERSION_KEY = "san_version"
const SAN_VERSION = 2

module.exports = {
    EXPORT_TIMEOUT_MLS,
    SAN_VERSION_KEY,
    SAN_VERSION
}
