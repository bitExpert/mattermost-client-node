/* eslint-disable */
const Client = require('../../src/client.js');
const User = require('../../src/user.js');
const httpPort = 8065;
const wsPort = 443;
const host = 'localhost';
const adminUsername = 'admin';
const adminMail = 'admin@example.com';
const adminPassword = 'Admin12345!';
const adminGroup = 'privateteam';
let client = null;
let user = null;

beforeAll((done) => {
    client = new Client(host, adminGroup, {
        autoReconnect: false,
        useTLS: false,
        httpPort: httpPort,
        wssPort: wsPort,
        logger: 'noop'
    });
    client.on('loggedIn', function(user){
        user = user;
        done();
    });
    client.login(adminMail, adminPassword, null);
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

describe('users', () => {
    test('get current user', (done) => {
        client.on('meLoaded', function(me) {
            // user from login should be the same user as getMe()
            expect(me).toEqual(user);
            done();
        });
        client.getMe();
    });

    // test('get users status', (done) => {
    //     client.on('error', function(data){
    //         expect(error).toEqual({"error": "ENOTFOUND", "id": null});
    //         done();
    //     });
    // });
});
