import Client from '../src/client';
import {
    authenticationTests,
    channelsTests,
    initConstants,
    optionsTests,
    usersTests,
    websocketTests,
} from './testsuite-loader';

initConstants();

// eslint-disable-next-line
describe('sequentially run tests', () => {
    optionsTests(Client);
    authenticationTests(Client);
    channelsTests(Client);
    usersTests(Client);
    websocketTests(Client);
});
