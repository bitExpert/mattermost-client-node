/* eslint-disable no-undef */
let client = null;

export default (Client) => describe('channels', () => {
    beforeAll((done) => {
        client = new Client(CONNECTION.host, ADMIN.team, {
            autoReconnect: false,
            useTLS: false,
            httpPort: CONNECTION.httpPort,
            wssPort: CONNECTION.wsPort,
            logger: 'noop',
        });
        client.on('loggedIn', () => {
            done();
        });
        client.login(ADMIN.email, ADMIN.password, null);
    });

    afterAll(() => {
        client.Websocket.disconnect();
    });

    /*
    beforeEach((done) => {
    });

    afterEach(() => {
    });
    */

    // // sets `privateChannel` and `publicChannel` which is needed for some further tests
    // test('get all channels from current team for user', (done) => {
    //     client.on('channelsLoaded', (channelData) => {
    //         channelData.forEach((channel) => {
    //             expect(channel).toMatchObject(CHANNEL.mock);
    //         });
    //         done();
    //     });
    //     client.Channel.loadChannels();
    // });
});
