import Client from '../dist/esm/client';
import {
    authenticationTests,
    channelsTests,
    initConstants,
    optionsTests,
    teamsTests,
    usersTests,
    websocketTests,
} from './testsuite-loader';

initConstants();

// eslint-disable-next-line
describe('sequentially run esm bundle tests', () => {
    authenticationTests(Client);
    channelsTests(Client);
    optionsTests(Client);
    teamsTests(Client);
    usersTests(Client);
    websocketTests(Client);
});
