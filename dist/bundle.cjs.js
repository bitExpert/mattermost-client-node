'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var WebSocket = _interopDefault(require('isomorphic-ws'));
var Log = _interopDefault(require('log'));
var events = require('events');
var HttpsProxyAgent = _interopDefault(require('https-proxy-agent'));
var TextEncoding = _interopDefault(require('text-encoding'));
var request = _interopDefault(require('request'));
var querystring = _interopDefault(require('querystring'));

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
var Api = (function () {
    function Api(client) {
        this._token = null;
        this.client = client;
    }
    Api.prototype.apiCall = function (method, path, params, callback, callbackParams, isForm) {
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
            rejectUnauthorized: this.client.tlsverify,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': new TextEncoding.TextEncoder('utf-8').encode(postData).length,
                'X-Requested-With': 'XMLHttpRequest',
            },
        };
        if (this.client.additionalHeaders) {
            options.headers = Object.assign(options.headers, __assign({}, this.client.additionalHeaders));
        }
        if (this._token) {
            options.headers.Authorization = "BEARER " + this._token;
        }
        if (this.client.httpProxy) {
            options.proxy = this.client.httpProxy;
        }
        if (isForm) {
            options.headers['Content-Type'] = 'multipart/form-data';
            delete options.headers['Content-Length'];
            delete options.json;
            options.formData = params;
        }
        this.client.logger.debug(method + " " + path);
        this.client.logger.info("api url:" + options.uri);
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
    Api.prototype._getApiUrl = function (path) {
        var protocol = this.client.useTLS ? 'https://' : 'http://';
        var port = this.client.options.httpPort ? ":" + this.client.options.httpPort : '';
        return protocol + this.client.host + port + apiPrefix + path;
    };
    Object.defineProperty(Api.prototype, "token", {
        set: function (value) {
            this._token = value;
        },
        enumerable: true,
        configurable: true
    });
    return Api;
}());

var Channel = (function () {
    function Channel(client, usersRoute) {
        this._channels = {};
        this.client = client;
        this.usersRoute = usersRoute;
        this.initBindings();
    }
    Channel.prototype.initBindings = function () {
        this._onChannels = this._onChannels.bind(this);
        this._onUnreadsForChannels = this._onUnreadsForChannels.bind(this);
        this._onMembersFromChannels = this._onMembersFromChannels.bind(this);
        this._onChannelLastViewed = this._onChannelLastViewed.bind(this);
    };
    Channel.prototype.loadChannels = function () {
        var uri = "/users/me/teams/" + this.client.Team.teamID + "/channels";
        this.client.logger.info("Loading " + uri);
        return this.client.Api.apiCall('GET', uri, null, this._onChannels);
    };
    Channel.prototype.getUserDirectMessageChannel = function (userID, callback) {
        var channel = this.client.me.id + "__" + userID;
        channel = this.findChannelByName(channel);
        if (!channel) {
            channel = userID + "__" + this.client.me.id;
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
    Channel.prototype.loadUnreadsForChannels = function () {
        var uri = '/users/me/teams/unread';
        this.client.logger.info("Loading " + uri);
        return this.client.Api.apiCall('GET', uri, null, this._onUnreadsForChannels);
    };
    Channel.prototype.loadMembersFromChannels = function () {
        var uri = "/users/me/teams/" + this.client.Team.teamID + "/channels/members";
        this.client.logger.info("Loading " + uri);
        return this.client.Api.apiCall('GET', uri, null, this._onMembersFromChannels);
    };
    Channel.prototype.loadChannelLastViewed = function (channelId, prevChannelId) {
        if (prevChannelId === void 0) { prevChannelId = null; }
        var postData = {
            channel_id: channelId,
            prev_channel_id: prevChannelId,
        };
        var uri = '/channels/members/me/view';
        this.client.logger.info("Loading " + uri);
        return this.client.Api.apiCall('POST', uri, postData, this._onChannelLastViewed);
    };
    Channel.prototype.createDirectChannel = function (userID, callback) {
        var _this = this;
        var postData = [userID, this.client.me.id];
        return this.client.Api.apiCall('POST', '/channels/direct', postData, function (data, _headers) {
            _this.client.logger.info('Created Direct Channel.');
            return (callback != null) ? callback(data) : false;
        });
    };
    Channel.prototype.createGroupChannel = function (userIDs, callback) {
        var _this = this;
        return this.client.Api.apiCall('POST', '/channels/group', userIDs, function (data, _headers) {
            _this.client.logger.info('Created Group Channel.');
            return (callback != null) ? callback(data) : false;
        });
    };
    Channel.prototype.createPrivateChannel = function (privateChannel, callback) {
        var _this = this;
        return this.client.Api.apiCall('POST', '/channels', privateChannel, function (data, _headers) {
            _this.client.logger.info('Created Private Channel.');
            return (callback != null) ? callback(data) : false;
        });
    };
    Channel.prototype.addUserToChannel = function (privateChannel, callback) {
        var _this = this;
        var uri = "/channels/" + privateChannel.channel_id + "/members";
        return this.client.Api.apiCall('POST', uri, privateChannel, function (data, _headers) {
            _this.client.logger.info("Added User to Channel " + privateChannel.channel_id);
            return (callback != null) ? callback(data) : false;
        });
    };
    Channel.prototype.setChannelHeader = function (channelID, header) {
        var _this = this;
        var postData = {
            channel_id: channelID,
            channel_header: header,
        };
        return this.client.Api.apiCall('POST', this.client.Team.teamRoute() + "/channels/update_header", postData, function (_data, _headers) {
            _this.client.logger.debug('Channel header updated.');
            return true;
        });
    };
    Channel.prototype.getAllChannels = function () {
        return this._channels;
    };
    Channel.prototype.getChannelByID = function (id) {
        return this._channels[id];
    };
    Channel.prototype._onChannels = function (data, _headers, _params) {
        var _this = this;
        if (data && !data.error) {
            data.forEach(function (channel) {
                _this._channels[channel.id] = channel;
            });
            this.client.logger.info("Found " + Object.keys(data).length + " subscribed channels.");
            return this.client.emit('channelsLoaded', data);
        }
        this.client.logger.error("Failed to get subscribed channels list from server: " + data.error);
        return this.client.emit('error', { msg: 'failed to get channel list' });
    };
    Channel.prototype._onUnreadsForChannels = function (data, _headers, _params) {
        if (data && !data.error) {
            this.client.logger.info("Found " + Object.keys(data).length + " information about unreads.");
            return this.client.emit('channelsUnreadsLoaded', data);
        }
        this.client.logger.error("Failed to get unreads of channels from server: " + data.error);
        return this.client.emit('error', { msg: 'failed to get unreads for channels' });
    };
    Channel.prototype._onMembersFromChannels = function (data, _headers, _params) {
        if (data && !data.error) {
            this.client.logger.info("Found " + Object.keys(data).length + " channels.");
            return this.client.emit('membersFromChannelsLoaded', data);
        }
        this.client.logger.error("Failed to get messages from server: " + data.error);
        return this.client.emit('error', { msg: 'failed to get all members from channels' });
    };
    Channel.prototype._onChannelLastViewed = function (data, _headers, _params) {
        if (data && !data.error) {
            this.client.logger.info("Found " + Object.keys(data).length + " for last reads.");
            return this.client.emit('channelLastViewedLoaded', data);
        }
        this.client.logger.error("Failed to get last reads of channel(s) from server: " + data.error);
        return this.client.emit('error', { msg: 'failed to get last reads for channel(s)' });
    };
    Object.defineProperty(Channel.prototype, "channels", {
        get: function () {
            return this._channels;
        },
        set: function (value) {
            this._channels = value;
        },
        enumerable: true,
        configurable: true
    });
    Channel.prototype.channelRoute = function (channelId) {
        return this.client.Team.teamRoute() + "/channels/" + channelId;
    };
    Channel.prototype.findChannelByName = function (name) {
        var _this = this;
        var foundChannel = Object.keys(this._channels)
            .find(function (channel) {
            var channelName = _this._channels[channel].name;
            var channelDisplayName = _this._channels[channel].display_name;
            return channelName === name || channelDisplayName === name;
        });
        return foundChannel || null;
    };
    return Channel;
}());

var Post = (function () {
    function Post(client) {
        this._messageMaxRunes = 4000;
        this.client = client;
        this.initBindings();
    }
    Post.prototype.initBindings = function () {
        this._onMessages = this._onMessages.bind(this);
    };
    Post.prototype.loadMessagesFromChannel = function (channelId, options) {
        if (options === void 0) { options = {}; }
        var uri = "/channels/" + channelId + "/posts";
        var allowedOptions = ['page', 'per_page', 'since', 'before', 'after'];
        var params = {};
        Object.entries(options).forEach(function (option) {
            var key = option[0];
            var value = option[1];
            if (allowedOptions.indexOf(key) >= 0) {
                params[key] = value;
            }
        });
        if (!params.page) {
            params.page = 0;
        }
        if (!params.per_page) {
            params.per_page = 30;
        }
        uri += "?" + querystring.stringify(params);
        this.client.logger.info("Loading " + uri);
        return this.client.Api.apiCall('GET', uri, params, this._onMessages);
    };
    Post.prototype.postMessage = function (msg, channelID) {
        var _this = this;
        var postData = {
            message: msg,
            file_ids: [],
            create_at: 0,
            user_id: this.client.me.id,
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
        var chunks = this._chunkMessage(postData.message);
        postData.message = chunks.shift();
        return this.client.Api.apiCall('POST', '/posts', postData, function (_data, _headers) {
            _this.client.logger.debug('Posted message.');
            if ((chunks != null ? chunks.length : undefined) > 0) {
                var message = chunks.join();
                var chunksLenght = chunks ? chunks.length : undefined;
                _this.client.logger.debug("Recursively posting remainder of message: (" + chunksLenght + ")");
                return _this.postMessage(message, channelID);
            }
            return true;
        });
    };
    Post.prototype.customMessage = function (postData, channelID) {
        var _this = this;
        var chunks;
        var postDataExt = __assign({}, postData);
        if (postDataExt.message != null) {
            chunks = this._chunkMessage(postData.message);
            postDataExt.message = chunks.shift();
        }
        postDataExt.channel_id = channelID;
        return this.client.Api.apiCall('POST', '/posts', postData, function (_data, _headers) {
            _this.client.logger.debug('Posted custom message.');
            if ((chunks != null ? chunks.length : undefined) > 0) {
                _this.client.logger.debug("Recursively posting remainder of customMessage: (" + chunks.length + ")");
                postDataExt.message = chunks.join();
                return _this.customMessage(postData, channelID);
            }
            return true;
        });
    };
    Post.prototype.editPost = function (postId, msg) {
        var _this = this;
        var postData = msg;
        if (typeof msg === 'string') {
            postData = {
                id: postId,
                message: msg,
            };
        }
        return this.client.Api.apiCall('PUT', "/posts/" + postId, postData, function (_data, _headers) {
            _this.client.logger.debug('Edited post');
        });
    };
    Post.prototype.uploadFile = function (channelId, file, callback) {
        var _this = this;
        var formData = {
            channel_id: channelId,
            files: file,
        };
        return this.client.Api.apiCall('POST', '/files', formData, function (data, _headers) {
            _this.client.logger.debug('Posted file');
            return callback(data);
        }, {}, true);
    };
    Post.prototype.react = function (messageID, emoji) {
        var _this = this;
        var postData = {
            user_id: this.client.me.id,
            post_id: messageID,
            emoji_name: emoji,
            create_at: 0,
        };
        return this.client.Api.apiCall('POST', '/reactions', postData, function (_data, _headers) {
            _this.client.logger.debug('Created reaction');
        });
    };
    Post.prototype.unreact = function (messageID, emoji) {
        var _this = this;
        var uri = "/users/me/posts/" + messageID + "/reactions/" + emoji;
        return this.client.Api.apiCall('DELETE', uri, [], function (_data, _headers) {
            _this.client.logger.debug('Deleted reaction');
        });
    };
    Post.prototype._onMessages = function (data, _headers, _params) {
        if (data && !data.error) {
            this.client.logger.info("Found " + Object.keys(data).length + " messages.");
            return this.client.emit('messagesLoaded', data);
        }
        this.client.logger.error("Failed to get messages from server: " + data.error);
        return this.client.emit('error', { msg: 'failed to get messages' });
    };
    Object.defineProperty(Post.prototype, "messageMaxRunes", {
        set: function (value) {
            this._messageMaxRunes = value;
        },
        enumerable: true,
        configurable: true
    });
    Post.prototype._chunkMessage = function (msg) {
        if (!msg) {
            return [''];
        }
        return msg.match(new RegExp("(.|[\r\n]){1," + this._messageMaxRunes + "}", 'g'));
    };
    return Post;
}());

var Team = (function () {
    function Team(client, usersRoute) {
        this._teams = {};
        this._teamID = null;
        this.client = client;
        this.usersRoute = usersRoute;
        this.initBindings();
    }
    Team.prototype.initBindings = function () {
        this._onTeams = this._onTeams.bind(this);
        this._onTeamsByName = this._onTeamsByName.bind(this);
        this._onCreateTeam = this._onCreateTeam.bind(this);
        this._onAddUserToTeam = this._onAddUserToTeam.bind(this);
        this._onCheckIfTeamExists = this._onCheckIfTeamExists.bind(this);
    };
    Team.prototype.getTeams = function () {
        var uri = this.usersRoute + "/me/teams";
        this.client.logger.info("Loading " + uri);
        return this.client.Api.apiCall('GET', uri, null, this._onTeams);
    };
    Team.prototype.getTeamByName = function (teamName) {
        var uri = "/teams/name/" + teamName;
        this.client.logger.info("Loading " + uri);
        return this.client.Api.apiCall('GET', uri, null, this._onTeamsByName);
    };
    Team.prototype.checkIfTeamExists = function (teamName) {
        var uri = "/teams/name/" + teamName + "/exists";
        return this.client.Api.apiCall('GET', uri, null, this._onCheckIfTeamExists);
    };
    Team.prototype.createTeam = function (name, display_name, type) {
        if (type === void 0) { type = 'I'; }
        var uri = '/teams';
        return this.client.Api.apiCall('POST', uri, { name: name, display_name: display_name, type: type }, this._onCreateTeam);
    };
    Team.prototype.addUserToTeam = function (user_id, team_id) {
        var postData = {
            team_id: team_id,
            user_id: user_id,
        };
        var uri = "/teams/" + team_id + "/members";
        return this.client.Api.apiCall('POST', uri, postData, this._onAddUserToTeam);
    };
    Team.prototype._onTeams = function (data, _headers, _params) {
        var _this = this;
        if (data && !data.error) {
            this._teams = data;
            this.client.emit('teamsLoaded', data);
            if (!data.length) {
                return this._teams;
            }
            this.client.logger.info("Found " + Object.keys(this._teams).length + " teams.");
            this._teams
                .find(function (team) {
                var isTeamFound = team.name.toLowerCase() === _this.client.group.toLowerCase();
                _this.client.logger.debug("Testing " + team.name + " == " + _this.client.group);
                if (isTeamFound) {
                    _this._teamID = team.id;
                    _this.client.logger.info("Found team! " + team.id);
                }
                return isTeamFound;
            });
            this.client.User.loadUsers();
            return this.client.Channel.loadChannels();
        }
        this.client.logger.error('Failed to load Teams...');
        return this.client.reconnect();
    };
    Team.prototype._onTeamsByName = function (data, _headers, _params) {
        if (data && !data.error) {
            this.client.logger.info("Found " + Object.keys(data).length + " channels.");
            return this.client.emit('teamsByNameLoaded', data);
        }
        this.client.logger.error("Failed to get team by name from server: " + data.error);
        return this.client.emit('error', { msg: 'failed to get team by name' });
    };
    Team.prototype._onCreateTeam = function (data) {
        if (!data.error) {
            this.client.logger.info('Creating team...');
            return this.client.emit('teamCreated', data);
        }
        this.client.logger.error('Team creation failed', JSON.stringify(data));
        return this.client.emit('error', data);
    };
    Team.prototype._onAddUserToTeam = function (data) {
        if (!data.error) {
            this.client.logger.info('Adding user to team...');
            return this.client.emit('userAdded', data);
        }
        this.client.logger.error('An error occured while adding user to team: ', JSON.stringify(data));
        return this.client.emit('error', data);
    };
    Team.prototype._onCheckIfTeamExists = function (data) {
        if (!data.error) {
            this.client.logger.info('Checking if team exists...');
            return this.client.emit('teamChecked', data);
        }
        this.client.logger.error('An error occured while checking if team exists: ', JSON.stringify(data));
        return this.client.emit('error', data);
    };
    Object.defineProperty(Team.prototype, "teamID", {
        get: function () {
            return this._teamID;
        },
        set: function (value) {
            this._teamID = value;
        },
        enumerable: true,
        configurable: true
    });
    Team.prototype.teamRoute = function () {
        return this.usersRoute + "/me/teams/" + this.teamID;
    };
    return Team;
}());

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
            this.client.preferences = data;
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

var apiPrefix$1 = '/api/v4';
var usersRoute = '/users';
var defaultPingInterval = 60000;
var Client = (function (_super) {
    __extends(Client, _super);
    function Client(host, group, options) {
        var _this = _super.call(this) || this;
        _this.host = host;
        _this.group = group;
        _this.options = options || { wssPort: 443, httpPort: 80 };
        _this.additionalHeaders = {};
        _this.useTLS = !(process.env.MATTERMOST_USE_TLS || '').match(/^false|0|no|off$/i);
        if (typeof options.useTLS !== 'undefined') {
            _this.useTLS = options.useTLS;
        }
        _this.tlsverify = !(process.env.MATTERMOST_TLS_VERIFY || '').match(/^false|0|no|off$/i);
        if (typeof options.tlsverify !== 'undefined') {
            _this.tlsverify = options.tlsverify;
        }
        if (typeof options.additionalHeaders === 'object') {
            _this.additionalHeaders = options.additionalHeaders;
        }
        _this.authenticated = false;
        _this.connected = false;
        _this.hasAccessToken = false;
        _this.token = null;
        _this.me = null;
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
        process.env.LOG_LEVEL = process.env.MATTERMOST_LOG_LEVEL || 'info';
        if (typeof options.logger !== 'undefined') {
            switch (options.logger) {
                case 'noop':
                    _this.logger = {
                        debug: function () {
                        },
                        info: function () {
                        },
                        notice: function () {
                        },
                        warning: function () {
                        },
                        error: function () {
                        },
                    };
                    break;
                default:
                    _this.logger = options.logger;
                    break;
            }
        }
        else {
            _this.logger = Log;
        }
        _this.initModules();
        _this.initBindings();
        if (typeof options.messageMaxRunes !== 'undefined') {
            _this.Post.messageMaxRunes = options.messageMaxRunes;
        }
        return _this;
    }
    Client.prototype.initModules = function () {
        this.Api = new Api(this);
        this.Channel = new Channel(this, usersRoute);
        this.Post = new Post(this);
        this.User = new User(this, usersRoute);
        this.Team = new Team(this, usersRoute);
    };
    Client.prototype.initBindings = function () {
        this._onLogin = this._onLogin.bind(this);
        this._onRevoke = this._onRevoke.bind(this);
    };
    Client.prototype.login = function (email, password, mfaToken) {
        this.hasAccessToken = false;
        this.email = email;
        this.password = password;
        this.mfaToken = mfaToken;
        this.logger.info('Logging in...');
        return this.Api.apiCall('POST', usersRoute + "/login", {
            login_id: this.email,
            password: this.password,
            token: this.mfaToken,
        }, this._onLogin);
    };
    Client.prototype.revoke = function (userID) {
        return this.Api.apiCall('POST', usersRoute + "/" + userID + "/sessions/revoke", {}, this._onRevoke);
    };
    Client.prototype.tokenLogin = function (token) {
        this.token = token;
        this.Api.token = token;
        this.hasAccessToken = true;
        this.logger.info('Logging in with personal access token...');
        var uri = usersRoute + "/me";
        return this.Api.apiCall('GET', uri, null, this._onLogin);
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
                this.Api.token = headers.token;
            }
            this.socketUrl = this._getSocketUrl();
            this.logger.info("Websocket URL: " + this.socketUrl);
            this.me = data;
            this.emit('loggedIn', this.me);
            this.User.getMe();
            this.User.getPreferences();
            return this.Team.getTeams();
        }
        this.emit('error', data);
        this.authenticated = false;
        return this.reconnect();
    };
    Client.prototype._getSocketUrl = function () {
        var protocol = this.useTLS ? 'wss://' : 'ws://';
        var httpPort = this.options.httpPort ? ":" + this.options.httpPort : '';
        var wssPort = this.useTLS && this.options.wssPort ? ":" + this.options.wssPort : httpPort;
        return protocol + this.host + wssPort + apiPrefix$1 + "/websocket";
    };
    Client.prototype._onRevoke = function (data) {
        return this.emit('sessionRevoked', data);
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
        this.ws = new WebSocket(this.socketUrl, options);
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
        this.ws.on('message', function (data, _flags) {
            _this.onMessage(JSON.parse(data));
        });
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
            this._connAttempts += 1;
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
                this.User.loadUser(message.data.user_id);
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
    Client.prototype.dialog = function (triggerId, url, dialog) {
        var _this = this;
        var postData = {
            trigger_id: triggerId,
            url: url,
            dialog: dialog,
        };
        return this.Api.apiCall('POST', '/actions/dialogs/open', postData, function (_data, _headers) {
            _this.logger.debug('Created dialog');
        });
    };
    Client.prototype._send = function (message) {
        var messageExt = __assign({}, message);
        if (!this.connected) {
            return false;
        }
        this._messageID += 1;
        messageExt.id = this._messageID;
        messageExt.seq = messageExt.id;
        this._pending[messageExt.id] = messageExt;
        this.ws.send(JSON.stringify(messageExt));
        return messageExt;
    };
    return Client;
}(events.EventEmitter));

module.exports = Client;
