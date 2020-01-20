/* eslint-disable no-undef */
let client = null;

export default (Client) => describe('groups', () => {
    beforeAll((done) => {
        client = new Client(CONNECTION.host, ADMIN.team, {
            autoReconnect: false,
            useTLS: false,
            httpPort: CONNECTION.httpPort,
            wssPort: CONNECTION.wsPort,
            logger: 'noop',
        });
        client.on('loggedIn', (userData) => {
            currentUser = userData;
            done();
        });
        client.login(ADMIN.email, ADMIN.password, null);
    });

    afterAll(() => {
        client.disconnect();
    });
    /*
    beforeEach((done) => {
    });

    afterEach(() => {
    });
    */
});
