const authenticationTests = require('./authentication/authentication.test');
const channelsTests = require('./channels/channels.test');

describe('sequentially run tests', () => {
  authenticationTests()
  channelsTests()
})