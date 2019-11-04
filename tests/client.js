/* eslint-disable */
const Client = require('../src/client.js');
const User = require('../src/user.js');
const httpPort = 8065;
const wsPort = 443;
const host = 'localhost';
const adminUsername = 'admin';
const adminMail = 'admin@example.com';
const adminPassword = 'Admin12345!';
const adminGroup = 'privateteam';

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

describe('login', () => {
  test('client without any settings emits error', (done) => {
    // TODO: implement actual check
    // this outputs only the request object
    const client = new Client(null, null, {
      autoReconnect: false
    });
    client.on('error', function(error){
      expect(error).toEqual({"error": "ENOTFOUND", "id": null});
      done();
    });
    client.login();
  });

  test('client with correct settings can log in', (done) => {
    const client = new Client(host, adminGroup, {
      autoReconnect: false,
      useTLS: false,
      httpPort: httpPort,
      wssPort: wsPort,
      logger: 'noop'
    });
    client.on('loggedIn', function(user){
      // ToDo check instance against mattermost instance interface
      expect(user).toBeInstanceOf(User);
      expect(typeof user.email).toEqual('string');
      expect(user.email).toEqual(adminMail);
      expect(typeof user.username).toEqual('string');
      expect(user.username).toEqual(adminUsername);
      done();
    });
    client.login(adminMail, adminPassword, null);
  });
});
