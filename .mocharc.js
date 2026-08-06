// Node >= 22.18 strips types natively, loading .ts specs as ES modules and
// bypassing ts-node. Disable it (where the flag exists) so specs keep loading
// through ts-node as CJS.
const nodeOption = process.allowedNodeEnvironmentFlags.has('--experimental-strip-types')
  ? { 'node-option': ['no-experimental-strip-types'] }
  : {};

module.exports = {
  ...nodeOption,
  require: ['ts-node/register', 'source-map-support/register'],
  extension: ['ts', 'js'],
  reporter: 'spec',
  recursive: true
};
