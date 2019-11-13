import initConstants from './constants';
import authenticationTests from './authentication/authentication.test';
import channelsTests from './channels/channels.test';
import usersTests from './users/users.test';

initConstants();

// eslint-disable-next-line
describe('sequentially run tests', () => {
    authenticationTests();
    channelsTests();
    usersTests();
});
