/* eslint-disable no-undef */
let client = null;

export default (Client) => describe('websocket', () => {
    beforeAll((done) => {
        client = new Client(CONNECTION.host, ADMIN.team, {
            autoReconnect: false,
            useTLS: false,
            httpPort: CONNECTION.httpPort,
            wssPort: CONNECTION.wsPort,
            logger: 'noop',
        });
        client.on('loggedIn', () => {
            client.on('connected', () => done());
            client.Websocket.connect();
        });
        client.login(ADMIN.email, ADMIN.password, null);
    });

    afterAll(() => {
        client.Websocket.disconnect();
    });
    /*
    beforeAll(() => {
    });
    afterAll(() => {
    });
    */
    test('websocket message on send has correct shape', (done) => {
        const sendTest = client.Websocket._send({ foo: 'bar' });
        expect(sendTest).toMatchObject(WSMESSAGE.mock);
        done();
    });
});
