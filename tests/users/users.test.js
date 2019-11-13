import Client from '../../src/client.ts';

let client = null;
let currentUser = null;
let differentUser = null;
let privateChannel = null;
let publicChannel = null;

beforeAll((done) => {
    client = new Client(CONNECTION.host, ADMIN.group, {
        autoReconnect: false,
        useTLS: false,
        httpPort: CONNECTION.httpPort,
        wssPort: CONNECTION.wsPort,
        logger: 'noop',
    });
    client.on('loggedIn', function(userData){
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
export default () =>
describe('users', () => {
    test('get current user', (done) => {
        client.on('meLoaded', function(user) {
            expect(user).toMatchObject(ADMIN.mock);
            // user from login should be the same user as getMe()
            expect(user).toEqual(currentUser);
            done();
        });
        client.getMe();
    });

    test('get teams for user', (done) => {
        client.on('teamsLoaded', function(teamData) {
            teamData.forEach(function(team) {
                expect(team).toMatchObject(TEAM.mock);
            });
            done();
        });
        client.getTeams();
    });

    // sets `differentUser` which is needed for some further tests
    test('get all available users', (done) => {
        // ToDo test multiple pages: loadUsers(page)
        client.on('profilesLoaded', function(usersData) {
            usersData.forEach(function(user) {
                expect(user).toMatchObject(ALLUSERS.mock);
                if (user.username === USER.username) {
                    differentUser = user;
                }
            });
            done();
        });
        client.loadUsers();
    });

    test('get single user by ID from API', (done) => {
        expect(differentUser).not.toBeNull();
        client.on('profilesLoaded', function(user) {
            expect(user[0]).toMatchObject(ALLUSERS.mock);
            done();
        });
        // `differentUser` gets set in 'get all available users'
        client.loadUser(differentUser.id);
    });

    test('get single user by ID from client', (done) => {
        // `differentUser` gets set in 'get all available users'
        // only available once `_onLoadUsers` has been called once (via `loadUsers`)
        expect(differentUser).not.toBeNull();
        const user = client.getUserByID(differentUser.id);
        expect(user).toMatchObject(ALLUSERS.mock);
        done();
    });

    test('get single user by email from client', (done) => {
        // `differentUser` gets set in 'get all available users'
        // only available once `_onLoadUsers` has been called once (via `loadUsers`)
        expect(differentUser).not.toBeNull();
        const user = client.getUserByEmail(differentUser.email);
        expect(user).toMatchObject(ALLUSERS.mock);
        done();
    });

    test('get all users from client', (done) => {
        // only available once `_onLoadUsers` has been called once (via `loadUsers`)
        const usersData = client.getAllUsers();
        Object.values(usersData).forEach(function(user) {
            expect(user).toMatchObject(ALLUSERS.mock);
            if (user.username === USER.username) {
                differentUser = user;
            }
        });
        done();
    });

    // sets `privateChannel` and `publicChannel` which is needed for some further tests
    test('get all channels from current team for user', (done) => {
        client.on('channelsLoaded', function(channelData) {
            channelData.forEach(function(channel) {
                expect(channel).toMatchObject(CHANNEL.mock);
                if (channel.name === PRIVATECHANNEL) {
                    privateChannel = channel;
                }
                if (channel.name === PUBLICCHANNEL) {
                    publicChannel = channel;
                }
            });
            done();
        });
        client.loadChannels();
    });

    test('get all channels from client', (done) => {
        // only available once `_onChannels` has been called once (via `loadChannels`)
        const channelData = client.getAllChannels();
        Object.keys(channelData).forEach(function(channelId) {
            expect(channelData[channelId]).toMatchObject(CHANNEL.mock);
        });
        done();
    });

    test('get single channel from client', (done) => {
        // only available once `_onChannels` has been called once (via `loadChannels`)
        // `privateChannel` and `publicChannel` get set in
        // 'get all channels from current team for user'
        expect(client.getChannelByID(privateChannel.id)).toMatchObject(CHANNEL.mock);
        expect(client.getChannelByID(publicChannel.id)).toMatchObject(CHANNEL.mock);
        done();
    });
});
