import Client from '../dist/bundle.cjs';
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
describe('sequentially run cjs bundle tests', () => {
    optionsTests(Client);
    authenticationTests(Client);
    channelsTests(Client);
    usersTests(Client);
    websocketTests(Client);
});
