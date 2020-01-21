class Authentication {
    constructor(client, usersRoute) {
        this._authenticated = false;
        this._hasAccessToken = false;
        this.client = client;
        this.usersRoute = usersRoute;
        this.initBindings();
    }
    initBindings() {
        this._onLogin = this._onLogin.bind(this);
        this._onRevoke = this._onRevoke.bind(this);
    }
    login(email, password, mfaToken) {
        this._hasAccessToken = false;
        this._authEmail = email;
        this._authPassword = password;
        this._mfaToken = mfaToken;
        this.client.logger.info('Logging in...');
        return this.client.Api.apiCall('POST', `${this.usersRoute}/login`, {
            login_id: this._authEmail,
            password: this._authPassword,
            token: this._mfaToken,
        }, this._onLogin);
    }
    tokenLogin(token) {
        this._token = token;
        this._hasAccessToken = true;
        this.client.logger.info('Logging in with personal access token...');
        const uri = `${this.usersRoute}/me`;
        return this.client.Api.apiCall('GET', uri, null, this._onLogin);
    }
    revoke(userID) {
        return this.client.Api.apiCall('POST', `${this.usersRoute}/${userID}/sessions/revoke`, {}, this._onRevoke);
    }
    _onLogin(data, headers) {
        if (data) {
            if (!data.id) {
                this.client.logger.error('Login call failed', JSON.stringify(data));
                this.client.emit('error', data);
                this._authenticated = false;
                this.client.Websocket.reconnecting = false;
                return this.client.Websocket.reconnect();
            }
            this._authenticated = true;
            if (!this._hasAccessToken) {
                this._token = headers.token;
            }
            this.client.Websocket.socketUrl = this.client.Websocket.getSocketUrl();
            this.client.logger.info(`Websocket URL: ${this.client.Websocket.socketUrl}`);
            this.client.me = data;
            this.client.emit('loggedIn', this.client.me);
            this.client.User.getMe();
            this.client.User.getPreferences();
            return this.client.Team.getTeams();
        }
        this.client.emit('error', data);
        this._authenticated = false;
        return this.client.Websocket.reconnect();
    }
    _onRevoke(data) {
        return this.client.emit('sessionRevoked', data);
    }
    set authenticated(value) {
        this._authenticated = value;
    }
    get token() {
        return this._token;
    }
    set token(value) {
        this._token = value;
    }
    get mfaToken() {
        return this._mfaToken;
    }
    get authEmail() {
        return this._authEmail;
    }
    get authPassword() {
        return this._authPassword;
    }
}
export default Authentication;
//# sourceMappingURL=authentication.js.map