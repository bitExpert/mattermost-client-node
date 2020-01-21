/* eslint-disable no-undef */
let client = null;

export default (Client) => describe('options', () => {
    /*
    beforeAll(() => {
    });

    afterAll(() => {
    });

    beforeEach((done) => {
    });

    afterEach(() => {
    });
    */

    test('set additional header field', (done) => {
        client = new Client(CONNECTION.host, ADMIN.team, {
            autoReconnect: false,
            useTLS: false,
            httpPort: CONNECTION.httpPort,
            wssPort: CONNECTION.wsPort,
            logger: 'noop',
            additionalHeaders: {
                'some-header': 'some-header-value',
            },
        });
        const requestObj = client.Authentication.login(ADMIN.email, ADMIN.password, null);
        expect(requestObj.headers).toHaveProperty('some-header');
        expect(requestObj.headers).toHaveProperty('some-header', 'some-header-value');
        done();
        client.Websocket.disconnect();
    });
});
