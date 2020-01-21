"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var User = (function () {
    function User(client, usersRoute) {
        this._users = {};
        this.client = client;
        this.usersRoute = usersRoute;
        this.initBindings();
    }
    User.prototype.initBindings = function () {
        this._onMe = this._onMe.bind(this);
        this._onLoadUsers = this._onLoadUsers.bind(this);
        this._onLoadUser = this._onLoadUser.bind(this);
        this._onCreateUser = this._onCreateUser.bind(this);
        this._onPreferences = this._onPreferences.bind(this);
        this._onUsersOfChannel = this._onUsersOfChannel.bind(this);
    };
    User.prototype.getMe = function () {
        var uri = this.usersRoute + "/me";
        this.client.logger.info("Loading " + uri);
        return this.client.Api.apiCall('GET', uri, null, this._onMe);
    };
    User.prototype.loadUsers = function (page, byTeam) {
        if (page === void 0) { page = 0; }
        if (byTeam === void 0) { byTeam = true; }
        var uri = "/users?page=" + page + "&per_page=200";
        if (byTeam) {
            uri += "&in_team=" + this.client.Team.teamID;
        }
        this.client.logger.info("Loading " + uri);
        return this.client.Api.apiCall('GET', uri, null, this._onLoadUsers, { page: page });
    };
    User.prototype.loadUser = function (userId) {
        var uri = "/users/" + userId;
        this.client.logger.info("Loading " + uri);
        return this.client.Api.apiCall('GET', uri, null, this._onLoadUser, {});
    };
    User.prototype.loadUsersFromChannel = function (channelId) {
        var uri = "/channels/" + channelId + "/members";
        this.client.logger.info("Loading " + uri);
        return this.client.Api.apiCall('GET', uri, null, this._onUsersOfChannel);
    };
    User.prototype.getPreferences = function () {
        var uri = this.usersRoute + "/me/preferences";
        this.client.logger.info("Loading " + uri);
        return this.client.Api.apiCall('GET', uri, null, this._onPreferences);
    };
    User.prototype.createUser = function (user) {
        var uri = this.usersRoute + "?iid=";
        return this.client.Api.apiCall('POST', uri, user, this._onCreateUser);
    };
    User.prototype.getUserByID = function (id) {
        return this._users[id];
    };
    User.prototype.getUserByEmail = function (email) {
        return Object.values(this._users)
            .find(function (user) { return user.email === email; });
    };
    User.prototype.getAllUsers = function () {
        return this._users;
    };
    User.prototype._onMe = function (data, _headers, _params) {
        if (data && !data.error) {
            this.client.me = data;
            this.client.emit('meLoaded', data);
            return this.client.logger.info('Loaded Me...');
        }
        this.client.logger.error("Failed to load Me..." + data.error);
        return this.client.reconnect();
    };
    User.prototype._onLoadUsers = function (data, _headers, params) {
        var _this = this;
        if (data && !data.error) {
            data.forEach(function (user) {
                _this._users[user.id] = user;
            });
            this.client.logger.info("Found " + Object.keys(data).length + " profiles.");
            this.client.emit('profilesLoaded', data);
            if ((Object.keys(data).length > 200) && (params.page != null)) {
                return this.loadUsers(params.page + 1);
            }
            return this._users;
        }
        this.client.logger.error('Failed to load profiles from server.');
        return this.client.emit('error', { msg: 'failed to load profiles' });
    };
    User.prototype._onLoadUser = function (data, _headers, _params) {
        if (data && !data.error) {
            this._users[data.id] = data;
            return this.client.emit('profilesLoaded', [data]);
        }
        return this.client.emit('error', { msg: 'failed to load profile' });
    };
    User.prototype._onCreateUser = function (data) {
        if (data.id) {
            this.client.logger.info('Creating user...');
            return this.client.emit('created', data);
        }
        this.client.logger.error('User creation failed', JSON.stringify(data));
        return this.client.emit('error', data);
    };
    User.prototype._onUsersOfChannel = function (data, _headers, _params) {
        var _this = this;
        if (data && !data.error) {
            Object.entries(data).forEach(function (channel) {
                _this.client.Channel.channels[channel.id] = channel;
            });
            this.client.logger.info("Found " + Object.keys(data).length + " users.");
            return this.client.emit('usersOfChannelLoaded', data);
        }
        this.client.logger.error("Failed to get channel users from server: " + data.error);
        return this.client.emit('error', { msg: 'failed to get channel users' });
    };
    User.prototype._onPreferences = function (data, _headers, _params) {
        if (data && !data.error) {
            this._userPreferences = data;
            this.client.emit('preferencesLoaded', data);
            return this.client.logger.info('Loaded Preferences...');
        }
        this.client.logger.error("Failed to load Preferences..." + data.error);
        return this.client.reconnect();
    };
    Object.defineProperty(User.prototype, "users", {
        get: function () {
            return this._users;
        },
        set: function (value) {
            this._users = value;
        },
        enumerable: true,
        configurable: true
    });
    return User;
}());
exports.default = User;
//# sourceMappingURL=user.js.map