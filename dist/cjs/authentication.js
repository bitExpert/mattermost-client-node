"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Authentication = (function () {
    function Authentication(client, usersRoute) {
        this._authenticated = false;
        this._hasAccessToken = false;
        this.client = client;
        this.usersRoute = usersRoute;
        this.initBindings();
    }
    Authentication.prototype.initBindings = function () {
        this._onLogin = this._onLogin.bind(this);
        this._onRevoke = this._onRevoke.bind(this);
    };
    Authentication.prototype.login = function (email, password, mfaToken) {
        this._hasAccessToken = false;
        this._authEmail = email;
        this._authPassword = password;
        this._mfaToken = mfaToken;
        this.client.logger.info('Logging in...');
        return this.client.Api.apiCall('POST', this.usersRoute + "/login", {
            login_id: this._authEmail,
            password: this._authPassword,
            token: this._mfaToken,
        }, this._onLogin);
    };
    Authentication.prototype.tokenLogin = function (token) {
        this._token = token;
        this._hasAccessToken = true;
        this.client.logger.info('Logging in with personal access token...');
        var uri = this.usersRoute + "/me";
        return this.client.Api.apiCall('GET', uri, null, this._onLogin);
    };
    Authentication.prototype.revoke = function (userID) {
        return this.client.Api.apiCall('POST', this.usersRoute + "/" + userID + "/sessions/revoke", {}, this._onRevoke);
    };
    Authentication.prototype._onLogin = function (data, headers) {
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
            this.client.logger.info("Websocket URL: " + this.client.Websocket.socketUrl);
            this.client.me = data;
            this.client.emit('loggedIn', this.client.me);
            this.client.User.getMe();
            this.client.User.getPreferences();
            return this.client.Team.getTeams();
        }
        this.client.emit('error', data);
        this._authenticated = false;
        return this.client.Websocket.reconnect();
    };
    Authentication.prototype._onRevoke = function (data) {
        return this.client.emit('sessionRevoked', data);
    };
    Object.defineProperty(Authentication.prototype, "authenticated", {
        set: function (value) {
            this._authenticated = value;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Authentication.prototype, "token", {
        get: function () {
            return this._token;
        },
        set: function (value) {
            this._token = value;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Authentication.prototype, "mfaToken", {
        get: function () {
            return this._mfaToken;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Authentication.prototype, "authEmail", {
        get: function () {
            return this._authEmail;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Authentication.prototype, "authPassword", {
        get: function () {
            return this._authPassword;
        },
        enumerable: true,
        configurable: true
    });
    return Authentication;
}());
exports.default = Authentication;
//# sourceMappingURL=authentication.js.map