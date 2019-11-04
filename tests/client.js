const Client = require('../src/client.js');

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
    client.login();
    client.on('error', function(error){
      expect(error).toEqual({"error": "ENOTFOUND", "id": null});
      done();
    })
    client.disconnect();
  });
});
