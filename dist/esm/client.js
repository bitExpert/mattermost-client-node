import request from 'request';
import WebSocket from 'isomorphic-ws';
import TextEncoding from 'text-encoding';
import Log from 'log';
import querystring from 'querystring';
import { EventEmitter } from 'events';
import HttpsProxyAgent from 'https-proxy-agent';
import User from './user';
const apiPrefix = '/api/v4';
const usersRoute = '/users';
const defaultPingInterval = 60000;
class Client extends EventEmitter {
    constructor(host, group, options) {
        super();
        this.host = host;
        this.group = group;
        this.options = options || { wssPort: 443, httpPort: 80 };
        this.messageMaxRunes = 4000;
        this.additionalHeaders = {};
        this.getAllUsers = User.getAllUsers;
        this.useTLS = !(process.env.MATTERMOST_USE_TLS || '').match(/^false|0|no|off$/i);
        if (typeof options.useTLS !== 'undefined') {
            this.useTLS = options.useTLS;
        }
        this.tlsverify = !(process.env.MATTERMOST_TLS_VERIFY || '').match(/^false|0|no|off$/i);
        if (typeof options.tlsverify !== 'undefined') {
            this.tlsverify = options.tlsverify;
        }
        if (typeof options.messageMaxRunes !== 'undefined') {
            this.messageMaxRunes = options.messageMaxRunes;
        }
        if (typeof options.additionalHeaders === 'object') {
            this.additionalHeaders = options.additionalHeaders;
        }
        this.authenticated = false;
        this.connected = false;
        this.hasAccessToken = false;
        this.token = null;
        this.self = null;
        this.channels = {};
        this.users = {};
        this.teams = {};
        this.teamID = null;
        this.ws = null;
        this._messageID = 0;
        this._pending = {};
        this._pingInterval = (this.options.pingInterval != null)
            ? this.options.pingInterval
            : defaultPingInterval;
        this.autoReconnect = (this.options.autoReconnect != null)
            ? this.options.autoReconnect
            : true;
        this.httpProxy = (this.options.httpProxy != null) ? this.options.httpProxy : false;
        this._connecting = false;
        this._reconnecting = false;
        this._connAttempts = 0;
        process.env.LOG_LEVEL = process.env.MATTERMOST_LOG_LEVEL || 'info';
        if (typeof options.logger !== 'undefined') {
            switch (options.logger) {
                case 'noop':
                    this.logger = {
                        debug: () => {
                        },
                        info: () => {
                        },
                        notice: () => {
                        },
                        warning: () => {
                        },
                        error: () => {
                        },
                    };
                    break;
                default:
                    this.logger = options.logger;
                    break;
            }
        }
        else {
            this.logger = Log;
        }
        this._onLogin = this._onLogin.bind(this);
        this._onCreateTeam = this._onCreateTeam.bind(this);
        this._onCheckIfTeamExists = this._onCheckIfTeamExists.bind(this);
        this._onRevoke = this._onRevoke.bind(this);
        this._onCreateTeam = this._onCreateTeam.bind(this);
        this._onCheckIfTeamExists = this._onCheckIfTeamExists.bind(this);
        this._onAddUserToTeam = this._onAddUserToTeam.bind(this);
        this._onCreateUser = this._onCreateUser.bind(this);
        this._onLoadUsers = this._onLoadUsers.bind(this);
        this._onLoadUser = this._onLoadUser.bind(this);
        this._onChannels = this._onChannels.bind(this);
        this._onUsersOfChannel = this._onUsersOfChannel.bind(this);
        this._onMessages = this._onMessages.bind(this);
        this._onPreferences = this._onPreferences.bind(this);
        this._onMe = this._onMe.bind(this);
        this._onTeams = this._onTeams.bind(this);
        this._onTeamsByName = this._onTeamsByName.bind(this);
        this._onUnreadsForChannels = this._onUnreadsForChannels.bind(this);
        this._onChannelLastViewed = this._onChannelLastViewed.bind(this);
        this._onMembersFromChannels = this._onMembersFromChannels.bind(this);
    }
    login(email, password, mfaToken) {
        this.hasAccessToken = false;
        this.email = email;
        this.password = password;
        this.mfaToken = mfaToken;
        this.logger.info('Logging in...');
        return this._apiCall('POST', `${usersRoute}/login`, {
            login_id: this.email,
            password: this.password,
            token: this.mfaToken,
        }, this._onLogin);
    }
    revoke(userID) {
        return this._apiCall('POST', `${usersRoute}/${userID}/sessions/revoke`, {}, this._onRevoke);
    }
    createUser(user) {
        const uri = `${usersRoute}?iid=`;
        return this._apiCall('POST', uri, user, this._onCreateUser);
    }
    createTeam(name, display_name, type = 'I') {
        const uri = '/teams';
        return this._apiCall('POST', uri, { name, display_name, type }, this._onCreateTeam);
    }
    checkIfTeamExists(teamName) {
        const uri = `/teams/name/${teamName}/exists`;
        return this._apiCall('GET', uri, null, this._onCheckIfTeamExists);
    }
    addUserToTeam(user_id, team_id) {
        const postData = {
            team_id,
            user_id,
        };
        const uri = `/teams/${team_id}/members`;
        return this._apiCall('POST', uri, postData, this._onAddUserToTeam);
    }
    tokenLogin(token) {
        this.token = token;
        this.hasAccessToken = true;
        this.logger.info('Logging in with personal access token...');
        const uri = `${usersRoute}/me`;
        return this._apiCall('GET', uri, null, this._onLogin);
    }
    _onLogin(data, headers) {
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
            this.logger.info(`Websocket URL: ${this.socketUrl}`);
            this.self = data;
            this.emit('loggedIn', this.self);
            this.getMe();
            this.getPreferences();
            return this.getTeams();
        }
        this.emit('error', data);
        this.authenticated = false;
        return this.reconnect();
    }
    _getSocketUrl() {
        const protocol = this.useTLS ? 'wss://' : 'ws://';
        const httpPort = this.options.httpPort ? `:${this.options.httpPort}` : '';
        const wssPort = this.useTLS && this.options.wssPort ? `:${this.options.wssPort}` : httpPort;
        return `${protocol + this.host + wssPort + apiPrefix}/websocket`;
    }
    _onRevoke(data) {
        return this.emit('sessionRevoked', data);
    }
    _onCreateTeam(data) {
        if (!data.error) {
            this.logger.info('Creating team...');
            return this.emit('teamCreated', data);
        }
        this.logger.error('Team creation failed', JSON.stringify(data));
        return this.emit('error', data);
    }
    _onCheckIfTeamExists(data) {
        if (!data.error) {
            this.logger.info('Checking if team exists...');
            return this.emit('teamChecked', data);
        }
        this.logger.error('An error occured while checking if team exists: ', JSON.stringify(data));
        return this.emit('error', data);
    }
    _onAddUserToTeam(data) {
        if (!data.error) {
            this.logger.info('Adding user to team...');
            return this.emit('userAdded', data);
        }
        this.logger.error('An error occured while adding user to team: ', JSON.stringify(data));
        return this.emit('error', data);
    }
    _onCreateUser(data) {
        if (data.id) {
            this.logger.info('Creating user...');
            return this.emit('created', data);
        }
        this.logger.error('User creation failed', JSON.stringify(data));
        return this.emit('error', data);
    }
    _onLoadUsers(data, _headers, params) {
        if (data && !data.error) {
            data.forEach((user) => {
                this.users[user.id] = user;
            });
            this.logger.info(`Found ${Object.keys(data).length} profiles.`);
            this.emit('profilesLoaded', data);
            if ((Object.keys(data).length > 200) && (params.page != null)) {
                return this.loadUsers(params.page + 1);
            }
            return this.users;
        }
        this.logger.error('Failed to load profiles from server.');
        return this.emit('error', { msg: 'failed to load profiles' });
    }
    _onLoadUser(data, _headers, _params) {
        if (data && !data.error) {
            this.users[data.id] = data;
            return this.emit('profilesLoaded', [data]);
        }
        return this.emit('error', { msg: 'failed to load profile' });
    }
    _onChannels(data, _headers, _params) {
        if (data && !data.error) {
            data.forEach((channel) => {
                this.channels[channel.id] = channel;
            });
            this.logger.info(`Found ${Object.keys(data).length} subscribed channels.`);
            return this.emit('channelsLoaded', data);
        }
        this.logger.error(`Failed to get subscribed channels list from server: ${data.error}`);
        return this.emit('error', { msg: 'failed to get channel list' });
    }
    _onUsersOfChannel(data, _headers, _params) {
        if (data && !data.error) {
            Object.entries(data).forEach((channel) => {
                this.channels[channel.id] = channel;
            });
            this.logger.info(`Found ${Object.keys(data).length} users.`);
            return this.emit('usersOfChannelLoaded', data);
        }
        this.logger.error(`Failed to get channel users from server: ${data.error}`);
        return this.emit('error', { msg: 'failed to get channel users' });
    }
    _onMessages(data, _headers, _params) {
        if (data && !data.error) {
            this.logger.info(`Found ${Object.keys(data).length} messages.`);
            return this.emit('messagesLoaded', data);
        }
        this.logger.error(`Failed to get messages from server: ${data.error}`);
        return this.emit('error', { msg: 'failed to get messages' });
    }
    _onUnreadsForChannels(data, _headers, _params) {
        if (data && !data.error) {
            this.logger.info(`Found ${Object.keys(data).length} information about unreads.`);
            return this.emit('channelsUnreadsLoaded', data);
        }
        this.logger.error(`Failed to get unreads of channels from server: ${data.error}`);
        return this.emit('error', { msg: 'failed to get unreads for channels' });
    }
    _onChannelLastViewed(data, _headers, _params) {
        if (data && !data.error) {
            this.logger.info(`Found ${Object.keys(data).length} for last reads.`);
            return this.emit('channelLastViewedLoaded', data);
        }
        this.logger.error(`Failed to get last reads of channel(s) from server: ${data.error}`);
        return this.emit('error', { msg: 'failed to get last reads for channel(s)' });
    }
    _onMembersFromChannels(data, _headers, _params) {
        if (data && !data.error) {
            this.logger.info(`Found ${Object.keys(data).length} channels.`);
            return this.emit('membersFromChannelsLoaded', data);
        }
        this.logger.error(`Failed to get messages from server: ${data.error}`);
        return this.emit('error', { msg: 'failed to get all members from channels' });
    }
    _onPreferences(data, _headers, _params) {
        if (data && !data.error) {
            this.preferences = data;
            this.emit('preferencesLoaded', data);
            return this.logger.info('Loaded Preferences...');
        }
        this.logger.error(`Failed to load Preferences...${data.error}`);
        return this.reconnect();
    }
    _onMe(data, _headers, _params) {
        if (data && !data.error) {
            this.me = data;
            this.emit('meLoaded', data);
            return this.logger.info('Loaded Me...');
        }
        this.logger.error(`Failed to load Me...${data.error}`);
        return this.reconnect();
    }
    _onTeams(data, _headers, _params) {
        if (data && !data.error) {
            this.teams = data;
            this.emit('teamsLoaded', data);
            if (!data.length) {
                return this.teams;
            }
            this.logger.info(`Found ${Object.keys(this.teams).length} teams.`);
            this.teams
                .find((team) => {
                const isTeamFound = team.name.toLowerCase() === this.group.toLowerCase();
                this.logger.debug(`Testing ${team.name} == ${this.group}`);
                if (isTeamFound) {
                    this.teamID = team.id;
                    this.logger.info(`Found team! ${team.id}`);
                }
                return isTeamFound;
            });
            this.loadUsers();
            return this.loadChannels();
        }
        this.logger.error('Failed to load Teams...');
        return this.reconnect();
    }
    _onTeamsByName(data, _headers, _params) {
        if (data && !data.error) {
            this.logger.info(`Found ${Object.keys(data).length} channels.`);
            return this.emit('teamsByNameLoaded', data);
        }
        this.logger.error(`Failed to get team by name from server: ${data.error}`);
        return this.emit('error', { msg: 'failed to get team by name' });
    }
    channelRoute(channelId) {
        return `${this.teamRoute()}/channels/${channelId}`;
    }
    teamRoute() {
        return `${usersRoute}/me/teams/${this.teamID}`;
    }
    getMe() {
        const uri = `${usersRoute}/me`;
        this.logger.info(`Loading ${uri}`);
        return this._apiCall('GET', uri, null, this._onMe);
    }
    getPreferences() {
        const uri = `${usersRoute}/me/preferences`;
        this.logger.info(`Loading ${uri}`);
        return this._apiCall('GET', uri, null, this._onPreferences);
    }
    getTeams() {
        const uri = `${usersRoute}/me/teams`;
        this.logger.info(`Loading ${uri}`);
        return this._apiCall('GET', uri, null, this._onTeams);
    }
    getTeamByName(teamName) {
        const uri = `/teams/name/${teamName}`;
        this.logger.info(`Loading ${uri}`);
        return this._apiCall('GET', uri, null, this._onTeamsByName);
    }
    loadUsers(page = 0, byTeam = true) {
        let uri = `/users?page=${page}&per_page=200`;
        if (byTeam) {
            uri += `&in_team=${this.teamID}`;
        }
        this.logger.info(`Loading ${uri}`);
        return this._apiCall('GET', uri, null, this._onLoadUsers, { page });
    }
    loadUser(userId) {
        const uri = `/users/${userId}`;
        this.logger.info(`Loading ${uri}`);
        return this._apiCall('GET', uri, null, this._onLoadUser, {});
    }
    loadChannels() {
        const uri = `/users/me/teams/${this.teamID}/channels`;
        this.logger.info(`Loading ${uri}`);
        return this._apiCall('GET', uri, null, this._onChannels);
    }
    loadUsersFromChannel(channelId) {
        const uri = `/channels/${channelId}/members`;
        this.logger.info(`Loading ${uri}`);
        return this._apiCall('GET', uri, null, this._onUsersOfChannel);
    }
    loadMessagesFromChannel(channelId, options = {}) {
        let uri = `/channels/${channelId}/posts`;
        const allowedOptions = ['page', 'per_page', 'since', 'before', 'after'];
        const params = {};
        Object.entries(options).forEach((option) => {
            const key = option[0];
            const value = option[1];
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
        uri += `?${querystring.stringify(params)}`;
        this.logger.info(`Loading ${uri}`);
        return this._apiCall('GET', uri, params, this._onMessages);
    }
    loadChannelLastViewed(channelId, prevChannelId = null) {
        const postData = {
            channel_id: channelId,
            prev_channel_id: prevChannelId,
        };
        const uri = '/channels/members/me/view';
        this.logger.info(`Loading ${uri}`);
        return this._apiCall('POST', uri, postData, this._onChannelLastViewed);
    }
    loadUnreadsForChannels() {
        const uri = '/users/me/teams/unread';
        this.logger.info(`Loading ${uri}`);
        return this._apiCall('GET', uri, null, this._onUnreadsForChannels);
    }
    loadMembersFromChannels() {
        const uri = `/users/me/teams/${this.teamID}/channels/members`;
        this.logger.info(`Loading ${uri}`);
        return this._apiCall('GET', uri, null, this._onMembersFromChannels);
    }
    connect() {
        if (this._connecting) {
            return;
        }
        this._connecting = true;
        this.logger.info('Connecting...');
        const options = { rejectUnauthorized: this.tlsverify };
        if (this.httpProxy) {
            options.agent = new HttpsProxyAgent(this.httpProxy);
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.ws = new WebSocket(this.socketUrl, options);
        this.ws.on('error', (error) => {
            this._connecting = false;
            return this.emit('error', error);
        });
        this.ws.on('open', () => {
            this._connecting = false;
            this._reconnecting = false;
            this.connected = true;
            this.emit('connected');
            this._connAttempts = 0;
            this._lastPong = Date.now();
            const challenge = {
                action: 'authentication_challenge',
                data: {
                    token: this.token,
                },
            };
            this.logger.info('Sending challenge...');
            this._send(challenge);
            this.logger.info('Starting pinger...');
            this._pongTimeout = setInterval(() => {
                if (!this.connected) {
                    this.logger.error('Not connected in pongTimeout');
                    this.reconnect();
                    return;
                }
                if (this._lastPong && (Date.now() - this._lastPong) > (2 * this._pingInterval)) {
                    this.logger.error('Last pong is too old: %d', (Date.now() - this._lastPong) / 1000);
                    this.authenticated = false;
                    this.connected = false;
                    this.reconnect();
                    return;
                }
                this.logger.info('ping');
                this._send({ action: 'ping' });
            }, this._pingInterval);
            return this._pongTimeout;
        });
        this.ws.on('message', (data, _flags) => {
            this.onMessage(JSON.parse(data));
        });
        this.ws.on('close', (code, message) => {
            this.emit('close', code, message);
            this._connecting = false;
            this.connected = false;
            this.socketUrl = null;
            return this.reconnect();
        });
    }
    reconnect() {
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
            const timeout = this._connAttempts * 1000;
            this.logger.info('Reconnecting in %dms', timeout);
            return setTimeout(() => {
                this.logger.info('Attempting reconnect');
                if (this.hasAccessToken) {
                    return this.tokenLogin(this.token);
                }
                return this.login(this.email, this.password, this.mfaToken);
            }, timeout);
        }
        return false;
    }
    disconnect() {
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
    }
    onMessage(message) {
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
    }
    getUserDirectMessageChannel(userID, callback) {
        let channel = `${this.self.id}__${userID}`;
        channel = this.findChannelByName(channel);
        if (!channel) {
            channel = `${userID}__${this.self.id}`;
            channel = this.findChannelByName(channel);
        }
        if (channel) {
            if (callback != null) {
                callback(channel);
            }
            return;
        }
        this.createDirectChannel(userID, callback);
    }
    getAllChannels() {
        return this.channels;
    }
    getChannelByID(id) {
        return this.channels[id];
    }
    getUserByID(id) {
        return this.users[id];
    }
    getUserByEmail(email) {
        return Object.values(this.users)
            .find((user) => user.email === email);
    }
    customMessage(postData, channelID) {
        let chunks;
        const postDataExt = { ...postData };
        if (postDataExt.message != null) {
            chunks = this._chunkMessage(postData.message);
            postDataExt.message = chunks.shift();
        }
        postDataExt.channel_id = channelID;
        return this._apiCall('POST', '/posts', postData, (_data, _headers) => {
            this.logger.debug('Posted custom message.');
            if ((chunks != null ? chunks.length : undefined) > 0) {
                this.logger.debug(`Recursively posting remainder of customMessage: (${chunks.length})`);
                postDataExt.message = chunks.join();
                return this.customMessage(postData, channelID);
            }
            return true;
        });
    }
    dialog(triggerId, url, dialog) {
        const postData = {
            trigger_id: triggerId,
            url,
            dialog,
        };
        return this._apiCall('POST', '/actions/dialogs/open', postData, (_data, _headers) => {
            this.logger.debug('Created dialog');
        });
    }
    editPost(postId, msg) {
        let postData = msg;
        if (typeof msg === 'string') {
            postData = {
                id: postId,
                message: msg,
            };
        }
        return this._apiCall('PUT', `/posts/${postId}`, postData, (_data, _headers) => {
            this.logger.debug('Edited post');
        });
    }
    uploadFile(channelId, file, callback) {
        const formData = {
            channel_id: channelId,
            files: file,
        };
        return this._apiCall('POST', '/files', formData, (data, _headers) => {
            this.logger.debug('Posted file');
            return callback(data);
        }, {}, true);
    }
    react(messageID, emoji) {
        const postData = {
            user_id: this.self.id,
            post_id: messageID,
            emoji_name: emoji,
            create_at: 0,
        };
        return this._apiCall('POST', '/reactions', postData, (_data, _headers) => {
            this.logger.debug('Created reaction');
        });
    }
    unreact(messageID, emoji) {
        const uri = `/users/me/posts/${messageID}/reactions/${emoji}`;
        return this._apiCall('DELETE', uri, [], (_data, _headers) => {
            this.logger.debug('Deleted reaction');
        });
    }
    createDirectChannel(userID, callback) {
        const postData = [userID, this.self.id];
        return this._apiCall('POST', '/channels/direct', postData, (data, _headers) => {
            this.logger.info('Created Direct Channel.');
            return (callback != null) ? callback(data) : false;
        });
    }
    createGroupChannel(userIDs, callback) {
        return this._apiCall('POST', '/channels/group', userIDs, (data, _headers) => {
            this.logger.info('Created Group Channel.');
            return (callback != null) ? callback(data) : false;
        });
    }
    createPrivateChannel(privateChannel, callback) {
        return this._apiCall('POST', '/channels', privateChannel, (data, _headers) => {
            this.logger.info('Created Private Channel.');
            return (callback != null) ? callback(data) : false;
        });
    }
    addUserToChannel(privateChannel, callback) {
        const uri = `/channels/${privateChannel.channel_id}/members`;
        return this._apiCall('POST', uri, privateChannel, (data, _headers) => {
            this.logger.info(`Added User to Channel${privateChannel.channel_id}`);
            return (callback != null) ? callback(data) : false;
        });
    }
    findChannelByName(name) {
        const foundChannel = Object.keys(this.channels)
            .find((channel) => {
            const channelName = this.channels[channel].name;
            const channelDisplayName = this.channels[channel].display_name;
            return channelName === name || channelDisplayName === name;
        });
        return foundChannel || null;
    }
    _chunkMessage(msg) {
        if (!msg) {
            return [''];
        }
        return msg.match(new RegExp(`(.|[\r\n]){1,${this.messageMaxRunes}}`, 'g'));
    }
    postMessage(msg, channelID) {
        const postData = {
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
        const chunks = this._chunkMessage(postData.message);
        postData.message = chunks.shift();
        return this._apiCall('POST', '/posts', postData, (_data, _headers) => {
            this.logger.debug('Posted message.');
            if ((chunks != null ? chunks.length : undefined) > 0) {
                const message = chunks.join();
                const chunksLenght = chunks ? chunks.length : undefined;
                this.logger.debug(`Recursively posting remainder of message: (${chunksLenght})`);
                return this.postMessage(message, channelID);
            }
            return true;
        });
    }
    setChannelHeader(channelID, header) {
        const postData = {
            channel_id: channelID,
            channel_header: header,
        };
        return this._apiCall('POST', `${this.teamRoute()}/channels/update_header`, postData, (_data, _headers) => {
            this.logger.debug('Channel header updated.');
            return true;
        });
    }
    _send(message) {
        const messageExt = { ...message };
        if (!this.connected) {
            return false;
        }
        this._messageID += 1;
        messageExt.id = this._messageID;
        messageExt.seq = messageExt.id;
        this._pending[messageExt.id] = messageExt;
        this.ws.send(JSON.stringify(messageExt));
        return messageExt;
    }
    _apiCall(method, path, params, callback, callbackParams = {}, isForm = false) {
        let postData = '';
        if (params != null) {
            postData = JSON.stringify(params);
        }
        const options = {
            uri: this._getApiUrl(path),
            method,
            json: params,
            rejectUnauthorized: this.tlsverify,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': new TextEncoding.TextEncoder('utf-8').encode(postData).length,
                'X-Requested-With': 'XMLHttpRequest',
            },
        };
        if (this.additionalHeaders) {
            options.headers = Object.assign(options.headers, { ...this.additionalHeaders });
        }
        if (this.token) {
            options.headers.Authorization = `BEARER ${this.token}`;
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
        this.logger.debug(`${method} ${path}`);
        this.logger.info(`api url:${options.uri}`);
        return request(options, (error, res, value) => {
            if (error) {
                if (callback) {
                    return callback({ id: null, error: error.errno }, {}, callbackParams);
                }
            }
            else if (callback) {
                if ((res.statusCode === 200) || (res.statusCode === 201)) {
                    const safeValue = typeof value === 'string'
                        ? JSON.parse(value)
                        : value;
                    return callback(safeValue, res.headers, callbackParams);
                }
                return callback({
                    id: null,
                    error: `API response: ${res.statusCode} ${JSON.stringify(value)}`,
                }, res.headers, callbackParams);
            }
            return false;
        });
    }
    _getApiUrl(path) {
        const protocol = this.useTLS ? 'https://' : 'http://';
        const port = (this.options.httpPort != null) ? `:${this.options.httpPort}` : '';
        return protocol + this.host + port + apiPrefix + path;
    }
}
export default Client;
//# sourceMappingURL=client.js.map