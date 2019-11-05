/* eslint-disable */
const Client = require('../../src/client.ts');
const User = require('../../src/user.js');

/*
beforeEach(() => {
});

afterEach(() => {
});

beforeAll(() => {
});

afterAll(() => {
});
*/

module.exports = () =>
describe('authentication', () => {
    describe('login', () => {
        test('client without any settings emits error', (done) => {
            const client = new Client(null, null, {
                autoReconnect: false,
                logger: 'noop'
            });
            client.on('error', function(error){
                expect(error).toEqual({"error": "ENOTFOUND", "id": null});
                done();
            });
            client.login();
        });

        test('client with correct settings can log in', (done) => {
            const client = new Client(CONNECTION.host, ADMIN.group, {
                autoReconnect: false,
                useTLS: false,
                httpPort: CONNECTION.httpPort,
                wssPort: CONNECTION.wsPort,
                logger: 'noop'
            });
            client.on('loggedIn', function(user){
                // ToDo check instance against mattermost instance interface
                expect(user).toBeInstanceOf(User);
                expect(typeof user.email).toEqual('string');
                expect(user.email).toEqual(ADMIN.email);
                expect(typeof user.username).toEqual('string');
                expect(user.username).toEqual(ADMIN.username);
                done();
            });
            client.login(ADMIN.email, ADMIN.password, null);
        });

        test('client with correct settings can log in with autoReconnect: true', (done) => {
            const client = new Client(CONNECTION.host, ADMIN.group, {
                autoReconnect: true,
                useTLS: false,
                httpPort: CONNECTION.httpPort,
                wssPort: CONNECTION.wsPort,
                logger: 'noop'
            });
            client.on('loggedIn', function(user){
                // ToDo check instance against mattermost instance interface
                expect(user).toBeInstanceOf(User);
                expect(typeof user.email).toEqual('string');
                expect(user.email).toEqual(ADMIN.email);
                expect(typeof user.username).toEqual('string');
                expect(user.username).toEqual(ADMIN.username);
                done();
            });
            client.login(ADMIN.email, ADMIN.password, null);
        });

        test('client throws EPROTO error when TLS can not be used', (done) => {
            const client = new Client(CONNECTION.host, ADMIN.group, {
                autoReconnect: false,
                useTLS: true,
                httpPort: CONNECTION.httpPort,
                wssPort: CONNECTION.wsPort,
                logger: 'noop'
            });
            client.on('error', function(err){
                // ToDo check instance against mattermost instance interface
                expect(err).toEqual({ id: null, error: 'EPROTO' });
                done();
            });
            client.login(ADMIN.email, ADMIN.password, null);
        });
    });
});
