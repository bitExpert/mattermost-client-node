import request from 'request';
import WS from 'ws';
import TextEncoding from 'text-encoding';
import Log from 'log';
import querystring from 'querystring';
import { EventEmitter } from 'events';
import HttpsProxyAgent from 'https-proxy-agent';

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics = function(d, b) {
    extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return extendStatics(d, b);
};

function __extends(d, b) {
    extendStatics(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

var __assign = function() {
    __assign = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};

var apiPrefix = '/api/v4';
var usersRoute = '/users';
var messageMaxRunes = 4000;
var defaultPingInterval = 60000;
var Client = (function (_super) {
    __extends(Client, _super);
    function Client(host, group, options) {
        var _this = _super.call(this) || this;
        _this.host = host;
        _this.group = group;
        _this.options = options || { wssPort: 443, httpPort: 80 };
        _this.useTLS = !(process.env.MATTERMOST_USE_TLS || '').match(/^false|0|no|off$/i);
        if (typeof options.useTLS !== 'undefined') {
            _this.useTLS = options.useTLS;
        }
        _this.tlsverify = !(process.env.MATTERMOST_TLS_VERIFY || '').match(/^false|0|no|off$/i);
        if (typeof options.tlsverify !== 'undefined') {
            _this.tlsverify = options.tlsverify;
        }
        _this.authenticated = false;
        _this.connected = false;
        _this.hasAccessToken = false;
        _this.token = null;
        _this.self = null;
        _this.channels = {};
        _this.users = {};
        _this.teams = {};
        _this.teamID = null;
        _this.ws = null;
        _this._messageID = 0;
        _this._pending = {};
        _this._pingInterval = (_this.options.pingInterval != null)
            ? _this.options.pingInterval
            : defaultPingInterval;
        _this.autoReconnect = (_this.options.autoReconnect != null)
            ? _this.options.autoReconnect
            : true;
        _this.httpProxy = (_this.options.httpProxy != null) ? _this.options.httpProxy : false;
        _this._connecting = false;
        _this._reconnecting = false;
        _this._connAttempts = 0;
        _this.logger = new Log(process.env.MATTERMOST_LOG_LEVEL || 'info');
        if (typeof options.logger !== 'undefined') {
            switch (options.logger) {
                case 'noop':
                    _this.logger = {
                        debug: function () { },
                        info: function () { },
                        notice: function () { },
                        warning: function () { },
                        error: function () { },
                    };
                    break;
                default:
                    _this.logger = new Log(process.env.MATTERMOST_LOG_LEVEL || options.logger);
                    break;
            }
        }
        _this._onLogin = _this._onLogin.bind(_this);
        _this._onCreateTeam = _this._onCreateTeam.bind(_this);
        _this._onCheckIfTeamExists = _this._onCheckIfTeamExists.bind(_this);
        _this._onRevoke = _this._onRevoke.bind(_this);
        _this._onCreateTeam = _this._onCreateTeam.bind(_this);
        _this._onCheckIfTeamExists = _this._onCheckIfTeamExists.bind(_this);
        _this._onAddUserToTeam = _this._onAddUserToTeam.bind(_this);
        _this._onCreateUser = _this._onCreateUser.bind(_this);
        _this._onLoadUsers = _this._onLoadUsers.bind(_this);
        _this._onLoadUser = _this._onLoadUser.bind(_this);
        _this._onChannels = _this._onChannels.bind(_this);
        _this._onUsersOfChannel = _this._onUsersOfChannel.bind(_this);
        _this._onMessages = _this._onMessages.bind(_this);
        _this._onPreferences = _this._onPreferences.bind(_this);
        _this._onMe = _this._onMe.bind(_this);
        _this._onTeams = _this._onTeams.bind(_this);
        _this._onUnreadsForChannels = _this._onUnreadsForChannels.bind(_this);
        _this._onChannelLastViewed = _this._onChannelLastViewed.bind(_this);
        _this._onMembersFromChannels = _this._onMembersFromChannels.bind(_this);
        return _this;
    }
    Client.prototype.login = function (email, password, mfaToken) {
        this.hasAccessToken = false;
        this.email = email;
        this.password = password;
        this.mfaToken = mfaToken;
        this.logger.info('Logging in...');
        return this._apiCall('POST', usersRoute + "/login", {
            login_id: this.email,
            password: this.password,
            token: this.mfaToken,
        }, this._onLogin);
    };
    Client.prototype.revoke = function (userID) {
        return this._apiCall('POST', usersRoute + "/" + userID + "/sessions/revoke", {}, this._onRevoke);
    };
    Client.prototype.createUser = function (user) {
        var uri = usersRoute + "?iid=";
        return this._apiCall('POST', uri, user, this._onCreateUser);
    };
    Client.prototype.createTeam = function (name, display_name, type) {
        if (type === void 0) { type = 'I'; }
        var uri = '/teams';
        return this._apiCall('POST', uri, { name: name, display_name: display_name, type: type }, this._onCreateTeam);
    };
    Client.prototype.checkIfTeamExists = function (teamId) {
        var uri = "/teams/name/" + teamId + "/exists";
        return this._apiCall('GET', uri, null, this._onCheckIfTeamExists);
    };
    Client.prototype.addUserToTeam = function (user_id, team_id) {
        var postData = {
            team_id: team_id,
            user_id: user_id,
        };
        var uri = "/teams/name/" + team_id + "/members";
        return this._apiCall('POST', uri, postData, this._onAddUserToTeam);
    };
    Client.prototype.tokenLogin = function (token) {
        this.token = token;
        this.hasAccessToken = true;
        this.logger.info('Logging in with personal access token...');
        var uri = usersRoute + "/me";
        return this._apiCall('GET', uri, null, this._onLogin);
    };
    Client.prototype._onLogin = function (data, headers) {
        if (data) {
            if (!data.id) {
                this.logger.error('Login call failed', JSON.stringify(data));
                this.emit('error', data);
                this.authenticated = false;
                this._reconnecting = false;
                return this.reconnect();
            }
            this.authenticated = true;
            if (!this.hasAccessToken) {
                this.token = headers.token;
            }
            this.socketUrl = this._getSocketUrl();
            this.logger.info("Websocket URL: " + this.socketUrl);
            this.self = data;
            this.emit('loggedIn', this.self);
            this.getMe();
            this.getPreferences();
            return this.getTeams();
        }
        this.emit('error', data);
        this.authenticated = false;
        return this.reconnect();
    };
    Client.prototype._getSocketUrl = function () {
        var protocol = this.useTLS ? 'wss://' : 'ws://';
        var httpPort = this.options.httpPort ? ":" + this.options.httpPort : '';
        var wssPort = this.useTLS && this.options.wssPort ? ":" + this.options.wssPort : httpPort;
        return protocol + this.host + wssPort + apiPrefix + "/websocket";
    };
    Client.prototype._onRevoke = function (data) {
        return this.emit('sessionRevoked', data);
    };
    Client.prototype._onCreateTeam = function (data) {
        if (!data.error) {
            this.logger.info('Creating team...');
            return this.emit('teamCreated', data);
        }
        this.logger.error('Team creation failed', JSON.stringify(data));
        return this.emit('error', data);
    };
    Client.prototype._onCheckIfTeamExists = function (data) {
        if (!data.error) {
            this.logger.info('Checking if team exists...');
            return this.emit('teamChecked', data);
        }
        this.logger.error('An error occured while checking if team exists: ', JSON.stringify(data));
        return this.emit('error', data);
    };
    Client.prototype._onAddUserToTeam = function (data) {
        if (!data.error) {
            this.logger.info('Adding user to team...');
            return this.emit('userAdded', data);
        }
        this.logger.error('An error occured while adding user to team: ', JSON.stringify(data));
        return this.emit('error', data);
    };
    Client.prototype._onCreateUser = function (data) {
        if (data.id) {
            this.logger.info('Creating user...');
            return this.emit('created', data);
        }
        this.logger.error('User creation failed', JSON.stringify(data));
        return this.emit('error', data);
    };
    Client.prototype._onLoadUsers = function (data, _headers, params) {
        var _this = this;
        if (data && !data.error) {
            data.forEach(function (user) {
                _this.users[user.id] = user;
            });
            this.logger.info("Found " + Object.keys(data).length + " profiles.");
            this.emit('profilesLoaded', data);
            if ((Object.keys(data).length > 200) && (params.page != null)) {
                return this.loadUsers(params.page + 1);
            }
            return this.users;
        }
        this.logger.error('Failed to load profiles from server.');
        return this.emit('error', { msg: 'failed to load profiles' });
    };
    Client.prototype._onLoadUser = function (data, _headers, _params) {
        if (data && !data.error) {
            this.users[data.id] = data;
            return this.emit('profilesLoaded', [data]);
        }
        return this.emit('error', { msg: 'data missing or incorrect' });
    };
    Client.prototype._onChannels = function (data, _headers, _params) {
        var _this = this;
        if (data && !data.error) {
            data.forEach(function (channel) {
                _this.channels[channel.id] = channel;
            });
            this.logger.info("Found " + Object.keys(data).length + " subscribed channels.");
            return this.emit('channelsLoaded', data);
        }
        this.logger.error("Failed to get subscribed channels list from server: " + data.error);
        return this.emit('error', { msg: 'failed to get channel list' });
    };
    Client.prototype._onUsersOfChannel = function (data, _headers, _params) {
        var _this = this;
        if (data && !data.error) {
            Object.entries(data).forEach(function (channel) {
                _this.channels[channel.id] = channel;
            });
            this.logger.info("Found " + Object.keys(data).length + " subscribed channels.");
            return this.emit('usersOfChannelLoaded', data);
        }
        this.logger.error("Failed to get subscribed channels list from server: " + data.error);
        return this.emit('error', { msg: 'failed to get channel list' });
    };
    Client.prototype._onMessages = function (data, _headers, _params) {
        if (data && !data.error) {
            this.logger.info("Found " + Object.keys(data).length + " subscribed channels.");
            return this.emit('messagesLoaded', data);
        }
        this.logger.error("Failed to get messages from server: " + data.error);
        return this.emit('error', { msg: 'failed to get messages' });
    };
    Client.prototype._onUnreadsForChannels = function (data, _headers, _params) {
        if (data && !data.error) {
            this.logger.info("Found " + Object.keys(data).length + " information about unreads.");
            return this.emit('channelsUnreadsLoaded', data);
        }
        this.logger.error("Failed to get unreads of channels from server: " + data.error);
        return this.emit('error', { msg: 'failed to get unreads for channels' });
    };
    Client.prototype._onChannelLastViewed = function (data, _headers, _params) {
        if (data && !data.error) {
            this.logger.info("Found " + Object.keys(data).length + " for last reads.");
            return this.emit('channelLastViewedLoaded', data);
        }
        this.logger.error("Failed to get last reads of channel(s) from server: " + data.error);
        return this.emit('error', { msg: 'failed to get last reads for channel(s)' });
    };
    Client.prototype._onMembersFromChannels = function (data, _headers, _params) {
        if (data && !data.error) {
            this.logger.info("Found " + Object.keys(data).length + " channels.");
            return this.emit('membersFromChannelsLoaded', data);
        }
        this.logger.error("Failed to get messages from server: " + data.error);
        return this.emit('error', { msg: 'failed to get all members from channels' });
    };
    Client.prototype._onPreferences = function (data, _headers, _params) {
        if (data && !data.error) {
            this.preferences = data;
            this.emit('preferencesLoaded', data);
            return this.logger.info('Loaded Preferences...');
        }
        this.logger.error("Failed to load Preferences..." + data.error);
        return this.reconnect();
    };
    Client.prototype._onMe = function (data, _headers, _params) {
        if (data && !data.error) {
            this.me = data;
            this.emit('meLoaded', data);
            return this.logger.info('Loaded Me...');
        }
        this.logger.error("Failed to load Me..." + data.error);
        return this.reconnect();
    };
    Client.prototype._onTeams = function (data, _headers, _params) {
        var _this = this;
        if (data && !data.error) {
            this.teams = data;
            this.emit('teamsLoaded', data);
            this.logger.info("Found " + Object.keys(this.teams).length + " teams.");
            this.teams
                .find(function (team) {
                var isTeamFound = team.name.toLowerCase() === _this.group.toLowerCase();
                _this.logger.debug("Testing " + team.name + " == " + _this.group);
                if (isTeamFound) {
                    _this.teamID = team.id;
                    _this.logger.info("Found team! " + team.id);
                }
                return isTeamFound;
            });
            this.loadUsers();
            return this.loadChannels();
        }
        this.logger.error('Failed to load Teams...');
        return this.reconnect();
    };
    Client.prototype.channelRoute = function (channelId) {
        return this.teamRoute() + "/channels/" + channelId;
    };
    Client.prototype.teamRoute = function () {
        return usersRoute + "/me/teams/" + this.teamID;
    };
    Client.prototype.getMe = function () {
        var uri = usersRoute + "/me";
        this.logger.info("Loading " + uri);
        return this._apiCall('GET', uri, null, this._onMe);
    };
    Client.prototype.getPreferences = function () {
        var uri = usersRoute + "/me/preferences";
        this.logger.info("Loading " + uri);
        return this._apiCall('GET', uri, null, this._onPreferences);
    };
    Client.prototype.getTeams = function () {
        var uri = usersRoute + "/me/teams";
        this.logger.info("Loading " + uri);
        return this._apiCall('GET', uri, null, this._onTeams);
    };
    Client.prototype.loadUsers = function (page, byTeam) {
        if (page === void 0) { page = 0; }
        if (byTeam === void 0) { byTeam = true; }
        var uri = "/users?page=" + page + "&per_page=200";
        if (byTeam) {
            uri += "&in_team=" + this.teamID;
        }
        this.logger.info("Loading " + uri);
        return this._apiCall('GET', uri, null, this._onLoadUsers, { page: page });
    };
    Client.prototype.loadUser = function (userId) {
        var uri = "/users/" + userId;
        this.logger.info("Loading " + uri);
        return this._apiCall('GET', uri, null, this._onLoadUser, {});
    };
    Client.prototype.loadChannels = function () {
        var uri = "/users/me/teams/" + this.teamID + "/channels";
        this.logger.info("Loading " + uri);
        return this._apiCall('GET', uri, null, this._onChannels);
    };
    Client.prototype.loadUsersFromChannel = function (channelId) {
        var uri = "/channels/" + channelId + "/members";
        this.logger.info("Loading " + uri);
        return this._apiCall('GET', uri, null, this._onUsersOfChannel);
    };
    Client.prototype.loadMessagesFromChannel = function (channelId, options) {
        if (options === void 0) { options = {}; }
        var uri = "/channels/" + channelId + "/posts";
        var allowedOptions = ['page', 'per_page', 'since', 'before', 'after'];
        var params = {};
        Object.entries(options).forEach(function (option) {
            if (allowedOptions.indexOf(option) >= 0) {
                params[option] = options[option];
            }
        });
        if (!params.page) {
            params.page = 0;
        }
        if (!params.per_page) {
            params.per_page = 30;
        }
        uri += "?" + querystring.stringify(params);
        this.logger.info("Loading " + uri);
        return this._apiCall('GET', uri, params, this._onMessages);
    };
    Client.prototype.loadChannelLastViewed = function (channelId, prevChannelId) {
        if (prevChannelId === void 0) { prevChannelId = null; }
        var postData = {
            channel_id: channelId,
            prev_channel_id: prevChannelId,
        };
        var uri = '/channels/members/me/view';
        this.logger.info("Loading " + uri);
        return this._apiCall('POST', uri, postData, this._onChannelLastViewed);
    };
    Client.prototype.loadUnreadsForChannels = function () {
        var uri = '/users/me/teams/unread';
        this.logger.info("Loading " + uri);
        return this._apiCall('GET', uri, null, this._onUnreadsForChannels);
    };
    Client.prototype.loadMembersFromChannels = function () {
        var uri = "/users/me/teams/" + this.teamID + "/channels/members";
        this.logger.info("Loading " + uri);
        return this._apiCall('GET', uri, null, this._onMembersFromChannels);
    };
    Client.prototype.connect = function () {
        var _this = this;
        if (this._connecting) {
            return;
        }
        this._connecting = true;
        this.logger.info('Connecting...');
        var options = { rejectUnauthorized: this.tlsverify };
        if (this.httpProxy) {
            options.agent = new HttpsProxyAgent(this.httpProxy);
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.ws = new WS(this.socketUrl, options);
        this.ws.on('error', function (error) {
            _this._connecting = false;
            return _this.emit('error', error);
        });
        this.ws.on('open', function () {
            _this._connecting = false;
            _this._reconnecting = false;
            _this.connected = true;
            _this.emit('connected');
            _this._connAttempts = 0;
            _this._lastPong = Date.now();
            var challenge = {
                action: 'authentication_challenge',
                data: {
                    token: _this.token,
                },
            };
            _this.logger.info('Sending challenge...');
            _this._send(challenge);
            _this.logger.info('Starting pinger...');
            _this._pongTimeout = setInterval(function () {
                if (!_this.connected) {
                    _this.logger.error('Not connected in pongTimeout');
                    _this.reconnect();
                    return;
                }
                if (_this._lastPong && (Date.now() - _this._lastPong) > (2 * _this._pingInterval)) {
                    _this.logger.error('Last pong is too old: %d', (Date.now() - _this._lastPong) / 1000);
                    _this.authenticated = false;
                    _this.connected = false;
                    _this.reconnect();
                    return;
                }
                _this.logger.info('ping');
                _this._send({ action: 'ping' });
            }, _this._pingInterval);
            return _this._pongTimeout;
        });
        this.ws.on('message', function (data, _flags) { return _this.onMessage(JSON.parse(data)); });
        this.ws.on('close', function (code, message) {
            _this.emit('close', code, message);
            _this._connecting = false;
            _this.connected = false;
            _this.socketUrl = null;
            return _this.reconnect();
        });
    };
    Client.prototype.reconnect = function () {
        var _this = this;
        if (this.autoReconnect) {
            if (this._reconnecting) {
                this.logger.info('WARNING: Already reconnecting.');
            }
            this._connecting = false;
            this._reconnecting = true;
            if (this._pongTimeout) {
                clearInterval(this._pongTimeout);
                this._pongTimeout = null;
            }
            this.authenticated = false;
            if (this.ws) {
                this.ws.close();
            }
            this._connAttempts = this._connAttempts + 1;
            var timeout = this._connAttempts * 1000;
            this.logger.info('Reconnecting in %dms', timeout);
            return setTimeout(function () {
                _this.logger.info('Attempting reconnect');
                if (_this.hasAccessToken) {
                    return _this.tokenLogin(_this.token);
                }
                return _this.login(_this.email, _this.password, _this.mfaToken);
            }, timeout);
        }
        return false;
    };
    Client.prototype.disconnect = function () {
        if (!this.connected) {
            return false;
        }
        this.autoReconnect = false;
        if (this._pongTimeout) {
            clearInterval(this._pongTimeout);
            this._pongTimeout = null;
        }
        this.ws.close();
        return true;
    };
    Client.prototype.onMessage = function (message) {
        this.emit('raw_message', message);
        switch (message.event) {
            case 'ping':
                this.logger.info('ACK ping');
                this._lastPong = Date.now();
                return this.emit('ping', message);
            case 'posted':
                return this.emit('message', message);
            case 'added_to_team':
            case 'authentication_challenge':
            case 'channel_converted':
            case 'channel_created':
            case 'channel_deleted':
            case 'channel_member_updated':
            case 'channel_updated':
            case 'channel_viewed':
            case 'config_changed':
            case 'delete_team':
            case 'ephemeral_message':
            case 'hello':
            case 'typing':
            case 'post_edit':
            case 'post_deleted':
            case 'preference_changed':
            case 'user_added':
            case 'user_removed':
            case 'user_role_updated':
            case 'user_updated':
            case 'status_change':
            case 'webrtc':
                return this.emit(message.event, message);
            case 'new_user':
                this.loadUser(message.data.user_id);
                return this.emit('new_user', message);
            default:
                if ((message.data ? message.data.text : undefined) && (message.data.text === 'pong')) {
                    this.logger.info('ACK ping (2)');
                    this._lastPong = Date.now();
                    return this.emit('ping', message);
                }
                this.logger.debug('Received unhandled message:');
                return this.logger.debug(message);
        }
    };
    Client.prototype.getUserDirectMessageChannel = function (userID, callback) {
        var channel = this.self.id + "__" + userID;
        channel = this.findChannelByName(channel);
        if (!channel) {
            channel = userID + "__" + this.self.id;
            channel = this.findChannelByName(channel);
        }
        if (channel) {
            if (callback != null) {
                callback(channel);
            }
            return;
        }
        this.createDirectChannel(userID, callback);
    };
    Client.prototype.getAllChannels = function () {
        return this.channels;
    };
    Client.prototype.getChannelByID = function (id) {
        return this.channels[id];
    };
    Client.prototype.getUserByID = function (id) {
        return this.users[id];
    };
    Client.prototype.getUserByEmail = function (email) {
        return Object.values(this.users)
            .find(function (user) { return user.email === email; });
    };
    Client.prototype.customMessage = function (postData, channelID) {
        var _this = this;
        var chunks;
        var postDataExt = __assign({}, postData);
        if (postDataExt.message != null) {
            chunks = Client._chunkMessage(postData.message);
            postDataExt.message = chunks.shift();
        }
        postDataExt.channel_id = channelID;
        return this._apiCall('POST', '/posts', postData, function (_data, _headers) {
            _this.logger.debug('Posted custom message.');
            if ((chunks != null ? chunks.length : undefined) > 0) {
                _this.logger.debug("Recursively posting remainder of customMessage: (" + chunks.length + ")");
                postDataExt.message = chunks.join();
                return _this.customMessage(postData, channelID);
            }
            return true;
        });
    };
    Client.prototype.dialog = function (triggerId, url, dialog) {
        var _this = this;
        var postData = {
            trigger_id: triggerId,
            url: url,
            dialog: dialog,
        };
        return this._apiCall('POST', '/actions/dialogs/open', postData, function (_data, _headers) {
            _this.logger.debug('Created dialog');
        });
    };
    Client.prototype.editPost = function (postId, msg) {
        var _this = this;
        var postData = msg;
        if (typeof msg === 'string') {
            postData = {
                id: postId,
                message: msg,
            };
        }
        return this._apiCall('PUT', "/posts/" + postId, postData, function (_data, _headers) {
            _this.logger.debug('Edited post');
        });
    };
    Client.prototype.uploadFile = function (channelId, file, callback) {
        var _this = this;
        var formData = {
            channel_id: channelId,
            files: file,
        };
        return this._apiCall('POST', '/files', formData, function (data, _headers) {
            _this.logger.debug('Posted file');
            return callback(data);
        }, {}, true);
    };
    Client.prototype.react = function (messageID, emoji) {
        var _this = this;
        var postData = {
            user_id: this.self.id,
            post_id: messageID,
            emoji_name: emoji,
            create_at: 0,
        };
        return this._apiCall('POST', '/reactions', postData, function (_data, _headers) {
            _this.logger.debug('Created reaction');
        });
    };
    Client.prototype.unreact = function (messageID, emoji) {
        var _this = this;
        var uri = "/users/me/posts/" + messageID + "/reactions/" + emoji;
        return this._apiCall('DELETE', uri, [], function (_data, _headers) {
            _this.logger.debug('Deleted reaction');
        });
    };
    Client.prototype.createDirectChannel = function (userID, callback) {
        var _this = this;
        var postData = [userID, this.self.id];
        return this._apiCall('POST', '/channels/direct', postData, function (data, _headers) {
            _this.logger.info('Created Direct Channel.');
            return (callback != null) ? callback(data) : false;
        });
    };
    Client.prototype.createGroupChannel = function (userIDs, callback) {
        var _this = this;
        return this._apiCall('POST', '/channels/group', userIDs, function (data, _headers) {
            _this.logger.info('Created Group Channel.');
            return (callback != null) ? callback(data) : false;
        });
    };
    Client.prototype.createPrivateChannel = function (privateChannel, callback) {
        var _this = this;
        return this._apiCall('POST', '/channels', privateChannel, function (data, _headers) {
            _this.logger.info('Created Private Channel.');
            return (callback != null) ? callback(data) : false;
        });
    };
    Client.prototype.addUserToChannel = function (privateChannel, callback) {
        var _this = this;
        var uri = "/channels/" + privateChannel.channel_id + "/members";
        return this._apiCall('POST', uri, privateChannel, function (data, _headers) {
            _this.logger.info("Added User to Channel" + privateChannel.channel_id);
            return (callback != null) ? callback(data) : false;
        });
    };
    Client.prototype.findChannelByName = function (name) {
        var _this = this;
        var foundChannel = Object.keys(this.channels)
            .find(function (channel) {
            var channelName = _this.channels[channel].name;
            var channelDisplayName = _this.channels[channel].display_name;
            return channelName === name || channelDisplayName === name;
        });
        return foundChannel || null;
    };
    Client._chunkMessage = function (msg) {
        if (!msg) {
            return [''];
        }
        return msg.match(new RegExp("(.|[\r\n]){1," + messageMaxRunes + "}", 'g'));
    };
    Client.prototype.postMessage = function (msg, channelID) {
        var _this = this;
        var postData = {
            message: msg,
            file_ids: [],
            create_at: 0,
            user_id: this.self.id,
            channel_id: channelID,
        };
        if (typeof msg === 'string') {
            postData.message = msg;
        }
        else {
            postData.message = msg.message;
            if (msg.props) {
                postData.props = msg.props;
            }
            if (msg.file_ids) {
                postData.file_ids = msg.file_ids;
            }
        }
        var chunks = Client._chunkMessage(postData.message);
        postData.message = chunks.shift();
        return this._apiCall('POST', '/posts', postData, function (_data, _headers) {
            _this.logger.debug('Posted message.');
            if ((chunks != null ? chunks.length : undefined) > 0) {
                var message = chunks.join();
                var chunksLenght = chunks ? chunks.length : undefined;
                _this.logger.debug("Recursively posting remainder of message: (" + chunksLenght + ")");
                return _this.postMessage(message, channelID);
            }
            return true;
        });
    };
    Client.prototype.setChannelHeader = function (channelID, header) {
        var _this = this;
        var postData = {
            channel_id: channelID,
            channel_header: header,
        };
        return this._apiCall('POST', this.teamRoute() + "/channels/update_header", postData, function (_data, _headers) {
            _this.logger.debug('Channel header updated.');
            return true;
        });
    };
    Client.prototype._send = function (message) {
        var messageExt = __assign({}, message);
        if (!this.connected) {
            return false;
        }
        this._messageID = this._messageID + 1;
        messageExt.id = this._messageID;
        messageExt.seq = message.id;
        this._pending[message.id] = message;
        this.ws.send(JSON.stringify(messageExt));
        return messageExt;
    };
    Client.prototype._apiCall = function (method, path, params, callback, callbackParams, isForm) {
        if (callbackParams === void 0) { callbackParams = {}; }
        if (isForm === void 0) { isForm = false; }
        var postData = '';
        if (params != null) {
            postData = JSON.stringify(params);
        }
        var options = {
            uri: this._getApiUrl(path),
            method: method,
            json: params,
            rejectUnauthorized: this.tlsverify,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': new TextEncoding.TextEncoder('utf-8').encode(postData).length,
                'X-Requested-With': 'XMLHttpRequest',
            },
        };
        if (this.token) {
            options.headers.Authorization = "BEARER " + this.token;
        }
        if (this.httpProxy) {
            options.proxy = this.httpProxy;
        }
        if (isForm) {
            options.headers['Content-Type'] = 'multipart/form-data';
            delete options.headers['Content-Length'];
            delete options.json;
            options.formData = params;
        }
        this.logger.debug(method + " " + path);
        this.logger.info("api url:" + options.uri);
        return request(options, function (error, res, value) {
            if (error) {
                if (callback) {
                    return callback({ id: null, error: error.errno }, {}, callbackParams);
                }
            }
            else if (callback) {
                if ((res.statusCode === 200) || (res.statusCode === 201)) {
                    var safeValue = typeof value === 'string'
                        ? JSON.parse(value)
                        : value;
                    return callback(safeValue, res.headers, callbackParams);
                }
                return callback({
                    id: null,
                    error: "API response: " + res.statusCode + " " + JSON.stringify(value),
                }, res.headers, callbackParams);
            }
            return false;
        });
    };
    Client.prototype._getApiUrl = function (path) {
        var protocol = this.useTLS ? 'https://' : 'http://';
        var port = (this.options.httpPort != null) ? ":" + this.options.httpPort : '';
        return protocol + this.host + port + apiPrefix + path;
    };
    return Client;
}(EventEmitter));

export default Client;
