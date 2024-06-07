module.exports = {
  require: ['ts-node/register', 'source-map-support/register'],
  extension: ['ts', 'js'],
  spec: 'src/test/**/*.{ts,js}',
  reporter: 'spec',
  recursive: true
};
