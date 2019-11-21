/* eslint-disable no-undef */
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

export default (Client) => describe('authentication', () => {
    describe('login', () => {
        /*
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
        */

        test('(admin) client with correct settings can log in', (done) => {
            const client = new Client(CONNECTION.host, ADMIN.group, {
                autoReconnect: false,
                useTLS: false,
                httpPort: CONNECTION.httpPort,
                wssPort: CONNECTION.wsPort,
                logger: 'noop',
            });
            client.on('loggedIn', (user) => {
                expect(user).toMatchObject(ADMIN.mock);
                expect(typeof user.email).toEqual('string');
                expect(user.email).toEqual(ADMIN.email);
                expect(typeof user.username).toEqual('string');
                expect(user.username).toEqual(ADMIN.username);
                done();
            });
            client.login(ADMIN.email, ADMIN.password, null);
        });

        test('(admin) client with correct settings can log in with autoReconnect: true', (done) => {
            const client = new Client(CONNECTION.host, ADMIN.group, {
                autoReconnect: true,
                useTLS: false,
                httpPort: CONNECTION.httpPort,
                wssPort: CONNECTION.wsPort,
                logger: 'noop',
            });
            client.on('loggedIn', (user) => {
                expect(user).toMatchObject(ADMIN.mock);
                expect(typeof user.email).toEqual('string');
                expect(user.email).toEqual(ADMIN.email);
                expect(typeof user.username).toEqual('string');
                expect(user.username).toEqual(ADMIN.username);
                done();
            });
            client.login(ADMIN.email, ADMIN.password, null);
        });

        test('(admin) client throws EPROTO error when TLS can not be used', (done) => {
            const client = new Client(CONNECTION.host, ADMIN.group, {
                autoReconnect: false,
                useTLS: true,
                httpPort: CONNECTION.httpPort,
                wssPort: CONNECTION.wsPort,
                logger: 'noop',
            });
            client.on('error', (err) => {
                expect(err).toEqual({ id: null, error: 'EPROTO' });
                done();
            });
            client.login(ADMIN.email, ADMIN.password, null);
        });

        test('(user) client with correct settings can log in', (done) => {
            const client = new Client(CONNECTION.host, USER.group, {
                autoReconnect: false,
                useTLS: false,
                httpPort: CONNECTION.httpPort,
                wssPort: CONNECTION.wsPort,
                logger: 'noop',
            });
            client.on('loggedIn', (user) => {
                expect(user).toMatchObject(USER.mock);
                expect(typeof user.email).toEqual('string');
                expect(user.email).toEqual(USER.email);
                expect(typeof user.username).toEqual('string');
                expect(user.username).toEqual(USER.username);
                done();
            });
            client.login(USER.email, USER.password, null);
        });

        test('(user) client with correct settings can log in with autoReconnect: true', (done) => {
            const client = new Client(CONNECTION.host, USER.group, {
                autoReconnect: true,
                useTLS: false,
                httpPort: CONNECTION.httpPort,
                wssPort: CONNECTION.wsPort,
                logger: 'noop',
            });
            client.on('loggedIn', (user) => {
                expect(user).toMatchObject(USER.mock);
                expect(typeof user.email).toEqual('string');
                expect(user.email).toEqual(USER.email);
                expect(typeof user.username).toEqual('string');
                expect(user.username).toEqual(USER.username);
                done();
            });
            client.login(USER.email, USER.password, null);
        });

        test('(user) client throws EPROTO error when TLS can not be used', (done) => {
            const client = new Client(CONNECTION.host, USER.group, {
                autoReconnect: false,
                useTLS: true,
                httpPort: CONNECTION.httpPort,
                wssPort: CONNECTION.wsPort,
                logger: 'noop',
            });
            client.on('error', (err) => {
                expect(err).toEqual({ id: null, error: 'EPROTO' });
                done();
            });
            client.login(USER.email, USER.password, null);
        });
    });
});
