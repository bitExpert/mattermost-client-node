const authenticationTests = require('./authentication/authentication.test');
const channelsTests = require('./channels/channels.test');
const usersTests = require('./users/users.test');

require('./constants.js');

describe('sequentially run tests', () => {
    authenticationTests();
    channelsTests();
    usersTests();
});
