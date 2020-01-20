/* eslint-disable no-undef */
let client = null;
let currentUser = null;
let differentUser = null;
let privateChannel = null;
let publicChannel = null;

export default (Client) => describe('users', () => {
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

    test('get current user', (done) => {
        client.on('meLoaded', (user) => {
            expect(user).toMatchObject(ADMIN.mock);
            // user from login should be the same user as getMe()
            expect(user).toEqual(currentUser);
            done();
        });
        client.User.getMe();
    });

    test('get users preferences', (done) => {
        client.on('preferencesLoaded', (preferences) => {
            preferences.forEach((preference) => {
                expect(preference).toMatchObject(PREFERENCES.mock);
            });
            done();
        });
        client.User.getPreferences();
    });

    test('get teams for user', (done) => {
        client.on('teamsLoaded', (teamData) => {
            teamData.forEach((team) => {
                expect(team).toMatchObject(TEAM.mock);
            });
            done();
        });
        client.getTeams();
    });

    test('get team by name', (done) => {
        client.on('teamsByNameLoaded', (teamData) => {
            expect(teamData).toMatchObject(TEAM.mock);
            done();
        });
        client.getTeamByName(ADMIN.team);
    });

    // sets `differentUser` which is needed for some further tests
    test('get all available users', (done) => {
        // ToDo test multiple pages: loadUsers(page)
        client.on('profilesLoaded', (usersData) => {
            usersData.forEach((user) => {
                expect(user).toMatchObject(ALLUSERS.mock);
                if (user.username === USER.username) {
                    differentUser = user;
                }
            });
            done();
        });
        client.User.loadUsers();
    });

    test('get single user by ID from API', (done) => {
        expect(differentUser).not.toBeNull();
        client.on('profilesLoaded', (user) => {
            expect(user[0]).toMatchObject(ALLUSERS.mock);
            done();
        });
        // `differentUser` gets set in 'get all available users'
        client.User.loadUser(differentUser.id);
    });

    test('get single user by ID from client', (done) => {
        // `differentUser` gets set in 'get all available users'
        // only available once `_onLoadUsers` has been called once (via `loadUsers`)
        expect(differentUser).not.toBeNull();
        const user = client.User.getUserByID(differentUser.id);
        expect(user).toMatchObject(ALLUSERS.mock);
        done();
    });

    test('get single user by email from client', (done) => {
        // `differentUser` gets set in 'get all available users'
        // only available once `_onLoadUsers` has been called once (via `loadUsers`)
        expect(differentUser).not.toBeNull();
        const user = client.User.getUserByEmail(differentUser.email);
        expect(user).toMatchObject(ALLUSERS.mock);
        done();
    });

    test('get all users from client', (done) => {
        // only available once `_onLoadUsers` has been called once (via `loadUsers`)
        const usersData = client.User.getAllUsers();
        Object.values(usersData).forEach((user) => {
            expect(user).toMatchObject(ALLUSERS.mock);
            if (user.username === USER.username) {
                differentUser = user;
            }
        });
        done();
    });

    // sets `privateChannel` and `publicChannel` which is needed for some further tests
    test('get all channels from current team for user', (done) => {
        client.on('channelsLoaded', (channelData) => {
            channelData.forEach((channel) => {
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
        Object.keys(channelData).forEach((channelId) => {
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
