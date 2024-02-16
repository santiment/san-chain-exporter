var SegfaultHandler = require('segfault-handler');


describe('segfault handler', () => {
  it('register handler succeeds', () => {
    SegfaultHandler.registerHandler('crash.log');
  });
});