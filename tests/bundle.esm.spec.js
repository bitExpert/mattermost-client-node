import Client from '../dist/bundle.esm';
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
describe('sequentially run esm bundle tests', () => {
    optionsTests(Client);
    authenticationTests(Client);
    channelsTests(Client);
    usersTests(Client);
    websocketTests(Client);
});
