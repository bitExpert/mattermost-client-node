import Client from '../dist/bundle.esm';
import initConstants from './constants';
import authenticationTests from './authentication/authentication.test';
import channelsTests from './channels/channels.test';
import usersTests from './users/users.test';
import websocketTests from './websocket/websocket.test';

initConstants();

// eslint-disable-next-line
describe('sequentially run esm bundle tests', () => {
    authenticationTests(Client);
    channelsTests(Client);
    usersTests(Client);
    websocketTests(Client);
});
