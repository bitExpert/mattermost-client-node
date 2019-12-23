import Client from '../dist/bundle.cjs';
import initConstants from './constants';
import optionsTests from './options/options.test';
import authenticationTests from './authentication/authentication.test';
import channelsTests from './channels/channels.test';
import usersTests from './users/users.test';
import websocketTests from './websocket/websocket.test';

initConstants();

// eslint-disable-next-line
describe('sequentially run cjs bundle tests', () => {
    optionsTests(Client);
    authenticationTests(Client);
    channelsTests(Client);
    usersTests(Client);
    websocketTests(Client);
});
