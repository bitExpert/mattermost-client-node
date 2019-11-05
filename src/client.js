const request = require('request');
const WebSocket = require('ws');
const TextEncoder = require('text-encoding');
const Log = require('log');
const querystring = require('querystring');
const { EventEmitter } = require('events');
const HttpsProxyAgent = require('https-proxy-agent');
const User = require('./user');
const Message = require('./message');

const apiPrefix = '/api/v4';
const usersRoute = '/users';
const messageMaxRunes = 4000;
const defaultPingInterval = 60000;

const tlsverify = !(process.env.MATTERMOST_TLS_VERIFY || '').match(/^false|0|no|off$/i);

class Client extends EventEmitter {
    constructor(host, group, options) {
        super();
        this.host = host;
        this.group = group;
        this.options = options || { wssPort: 443, httpPort: 80 };

        this.useTLS = !(process.env.MATTERMOST_USE_TLS || '').match(/^false|0|no|off$/i);
        if (typeof options.useTLS !== 'undefined') {
            this.useTLS = options.useTLS;
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

        this.logger = new Log(process.env.MATTERMOST_LOG_LEVEL || 'info');
        if (typeof options.logger !== 'undefined') {
            switch (options.logger) {
            case 'noop':
                this.logger = {
                    debug: () => {},
                    info: () => {},
                    notice: () => {},
                    warning: () => {},
                    error: () => {},
                };
                break;
            default:
                this.logger = new Log(process.env.MATTERMOST_LOG_LEVEL || options.logger);
                break;
            }
        }

        // Binding because async calls galore
        this._onLogin = this._onLogin.bind(this);
        this._onRevoke = this._onRevoke.bind(this);
        this._onCreateUser = this._onCreateUser.bind(this);
        this._onLoadUsers = this._onLoadUsers.bind(this);
        this._onLoadUser = this._onLoadUser.bind(this);
        this._onChannels = this._onChannels.bind(this);
        this._onUsersOfChannel = this._onUsersOfChannel.bind(this);
        this._onMessages = this._onMessages.bind(this);
        this._onPreferences = this._onPreferences.bind(this);
        this._onMe = this._onMe.bind(this);
        this._onTeams = this._onTeams.bind(this);
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
        return this._apiCall(
            'POST',
            `${usersRoute}/login`,
            {
                login_id: this.email,
                password: this.password,
                token: this.mfaToken,
            },
            this._onLogin,
        );
    }

    // revoke a user session
    revoke(userID) {
        return this._apiCall('POST', `${usersRoute}/${userID}/sessions/revoke`,
            {}, this._onRevoke);
    }

    createUser(user) {
        const postData = user;
        const uri = `${usersRoute}?iid=`;
        return this._apiCall('POST', uri, postData, this._onCreateUser);
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
            // Continue happy flow here
            if (!this.hasAccessToken) {
                this.token = headers.token;
            }
            this.socketUrl = this._getSocketUrl();
            this.logger.info(`Websocket URL: ${this.socketUrl}`);
            this.self = new User(data);
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
                return this.loadUsers(params.page + 1); // Trigger next page loading
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
        return this.emit('error', { msg: 'data missing or incorrect' });
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

    _onUsersOfChannel(data, headers, params) {
        if (data && !data.error) {
            Object.entries(data).forEach((channel) => {
                this.channels[channel.id] = channel;
            });
            this.logger.info(`Found ${Object.keys(data).length} subscribed channels.`);
            return this.emit('usersOfChannelLoaded', data);
        }
        this.logger.error(`Failed to get subscribed channels list from server: ${data.error}`);
        return this.emit('error', { msg: 'failed to get channel list' });
    }

    _onMessages(data, headers, params) {
        if (data && !data.error) {
            this.logger.info(`Found ${Object.keys(data).length} subscribed channels.`);
            return this.emit('messagesLoaded', data);
        }
        this.logger.error(`Failed to get messages from server: ${data.error}`);
        return this.emit('error', { msg: 'failed to get messages' });
    }

    _onUnreadsForChannels(data, headers, params) {
        if (data && !data.error) {
            this.logger.info(`Found ${Object.keys(data).length} information about unreads.`);
            return this.emit('channelsUnreadsLoaded', data);
        }
        this.logger.error(`Failed to get unreads of channels from server: ${data.error}`);
        return this.emit('error', { msg: 'failed to get unreads for channels' });
    }

    _onChannelLastViewed(data, headers, params) {
        if (data && !data.error) {
            this.logger.info(`Found ${Object.keys(data).length} for last reads.`);
            return this.emit('channelLastViewedLoaded', data);
        }
        this.logger.error(`Failed to get last reads of channel(s) from server: ${data.error}`);
        return this.emit('error', { msg: 'failed to get last reads for channel(s)' });
    }

    _onMembersFromChannels(data, headers, params) {
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

    loadUsers(page = 0, byTeam = true) {
        let uri = `/users?page=${page}&per_page=200`;
        // get onlmm_get_channelsy users of team (surveybot NOT included)
        if (byTeam) {
            uri += `&in_team=${this.teamID}`;
        }
        this.logger.info(`Loading ${uri}`);
        return this._apiCall('GET', uri, null, this._onLoadUsers, { page });
    }

    loadUser(user_id) {
        const uri = `/users/${user_id}`;
        this.logger.info(`Loading ${uri}`);
        return this._apiCall('GET', uri, null, this._onLoadUser, {});
    }

    loadChannels() {
        const uri = `/users/me/teams/${this.teamID}/channels`;
        this.logger.info(`Loading ${uri}`);
        return this._apiCall('GET', uri, null, this._onChannels);
    }

    loadUsersFromChannel(channel_id) {
        const uri = `/channels/${channel_id}/members`;
        this.logger.info(`Loading ${uri}`);
        return this._apiCall('GET', uri, null, this._onUsersOfChannel);
    }

    loadMessagesFromChannel(channel_id, options = {}) {
        let uri = `/channels/${channel_id}/posts`;
        const allowedOptions = ['page', 'per_page', 'since', 'before', 'after'];
        const params = {};
        Object.entries(options).forEach((option) => {
            if (allowedOptions.indexOf(option) >= 0) {
                params[option] = options[option];
            }
        });
        // set standard params for page / per_page if not set
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

    // to mark messages as read (e.g. after loading messages of channel)
    // trigger loadChannelLastViewed method
    loadChannelLastViewed(channel_id, prev_channel_id = null) {
        const postData = {
            channel_id,
            prev_channel_id,
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


    // method is needed e.g. to get detailed unreads (channels and direct messages)
    // iterate over this.channels and substract msg_count (result from this call)
    // from this.channels.total_msg_count
    loadMembersFromChannels() {
        const uri = `/users/me/teams/${this.teamID}/channels/members`;
        this.logger.info(`Loading ${uri}`);
        return this._apiCall('GET', uri, null, this._onMembersFromChannels);
    }

    connect() {
        if (this._connecting) { return; }

        this._connecting = true;
        this.logger.info('Connecting...');
        const options = { rejectUnauthorized: tlsverify };

        if (this.httpProxy) { options.agent = new HttpsProxyAgent(this.httpProxy); }

        // Set up websocket connection to server
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

        this.ws.on('message', (data, _flags) => this.onMessage(JSON.parse(data)));

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

            this._connAttempts = this._connAttempts + 1;

            const timeout = this._connAttempts * 1000;
            this.logger.info('Reconnecting in %dms', timeout);
            return setTimeout(
                () => {
                    this.logger.info('Attempting reconnect');
                    if (this.hasAccessToken) {
                        return this.tokenLogin(this.token);
                    }
                    return this.login(this.email, this.password, this.mfaToken);
                },
                timeout,
            );
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
        const m = new Message(message);
        switch (message.event) {
        case 'ping':
            // Deprecated
            this.logger.info('ACK ping');
            this._lastPong = Date.now();
            return this.emit('ping', message);
        case 'posted':
            return this.emit('message', m);
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
            // Generic handler
            return this.emit(message.event, message);
        case 'new_user':
            this.loadUser(message.data.user_id);
            return this.emit('new_user', message);
        default:
            // Check for `pong` response
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
        // check if channel already exists
        let channel = `${this.self.id}__${userID}`;
        channel = this.findChannelByName(channel);
        if (!channel) {
            // check if channel in other direction exists
            channel = `${userID}__${this.self.id}`;
            channel = this.findChannelByName(channel);
        }
        if (channel) {
            if (callback != null) { callback(channel); }
            return;
        }
        // channel obviously doesn't exist, let's create it
        this.createDirectChannel(userID, callback);
    }

    getAllChannels() {
        return this.channels;
    }

    getChannelByID(id) {
        return this.channels[id];
    }

    getAllUsers() {
        return this.users;
    }

    getUserByID(id) {
        return this.users[id];
    }

    getUserByEmail(email) {
        return Object.entries(this.users)
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

    dialog(trigger_id, url, dialog) {
        const postData = {
            trigger_id,
            url,
            dialog,
        };
        return this._apiCall('POST', '/actions/dialogs/open', postData, (_data, _headers) => {
            this.logger.debug('Created dialog');
        });
    }

    editPost(post_id, msg) {
        let postData = msg;
        if (typeof msg === 'string') {
            postData = {
                id: post_id,
                message: msg,
            };
        }
        return this._apiCall('PUT', `/posts/${post_id}`, postData, (_data, _headers) => {
            this.logger.debug('Edited post');
        });
    }

    uploadFile(channel_id, file, callback) {
        const formData = {
            channel_id,
            files: file,
        };

        return this._apiCall({ method: 'POST' }, '/files', formData, (data, _headers) => {
            this.logger.debug('Posted file');
            return callback(data);
        });
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

    // type "D"
    createDirectChannel(userID, callback) {
        const postData = [userID, this.self.id];
        return this._apiCall(
            'POST',
            '/channels/direct',
            postData,
            (data, _headers) => {
                this.logger.info('Created Direct Channel.');
                return (callback != null) ? callback(data) : false;
            },
        );
    }

    // type "G"
    createGroupChannel(userIDs, callback) {
        return this._apiCall(
            'POST',
            '/channels/group',
            userIDs,
            (data, headers) => {
                this.logger.info('Created Group Channel.');
                return (callback != null) ? callback(data) : false;
            },
        );
    }

    // type "P"
    createPrivateChannel(privateChannel, callback) {
        return this._apiCall(
            'POST',
            '/channels',
            privateChannel,
            (data, headers) => {
                this.logger.info('Created Private Channel.');
                return (callback != null) ? callback(data) : false;
            },
        );
    }

    addUserToChannel(privateChannel, callback) {
        const uri = `/channels/${privateChannel.channel_id}/members`;
        return this._apiCall(
            'POST',
            uri,
            privateChannel,
            (data, headers) => {
                this.logger.info(`Added User to Channel${privateChannel.channel_id}`);
                return (callback != null) ? callback(data) : false;
            },
        );
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

    static _chunkMessage(msg) {
        if (!msg) {
            return [''];
        }
        const message_limit = messageMaxRunes;
        let chunks = [];
        chunks = msg.match(new RegExp(`(.|[\r\n]){1,${message_limit}}`, 'g'));
        return chunks;
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
        } else {
            postData.message = msg.message;
            if (msg.props) {
                postData.props = msg.props;
            }
            if (msg.file_ids) {
                postData.file_ids = msg.file_ids;
            }
        }

        // break apart long messages
        const chunks = this._chunkMessage(postData.message);
        postData.message = chunks.shift();

        return this._apiCall('POST', '/posts', postData, (_data, _headers) => {
            this.logger.debug('Posted message.');

            if ((chunks != null ? chunks.length : undefined) > 0) {
                const message = chunks.join();
                this.logger.debug(`Recursively posting remainder of message: (${(chunks != null ? chunks.length : undefined)})`);
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

    // Private functions
    //
    _send(message) {
        const messageExt = { ...message };
        if (!this.connected) {
            return false;
        }
        this._messageID = this._messageID + 1;
        messageExt.id = this._messageID;
        messageExt.seq = message.id;
        this._pending[message.id] = message;
        this.ws.send(JSON.stringify(messageExt));
        return messageExt;
    }


    _apiCall(method, path, params, callback, callback_params = {}) {
        let isForm = false;
        let safeMethod = method;
        if (typeof method !== 'string') {
            isForm = true;
            safeMethod = method.method;
        }
        let post_data = '';
        if (params != null) { post_data = JSON.stringify(params); }
        const options = {
            uri: (this.useTLS ? 'https://' : 'http://') + this.host + ((this.options.httpPort != null) ? `:${this.options.httpPort}` : '') + apiPrefix + path,
            method: safeMethod,
            json: params,
            rejectUnauthorized: tlsverify,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': new TextEncoder.TextEncoder('utf-8').encode(post_data).length,
                'X-Requested-With': 'XMLHttpRequest',
            },
        };

        if (this.token) { options.headers.Authorization = `BEARER ${this.token}`; }
        if (this.httpProxy) { options.proxy = this.httpProxy; }

        if (isForm) {
            options.headers['Content-Type'] = 'multipart/form-data';
            delete options.headers['Content-Length'];
            delete options.json;
            options.formData = params;
        }

        this.logger.debug(`${safeMethod} ${path}`);
        this.logger.info(`api url:${options.uri}`);

        return request(options, (error, res, value) => {
            if (error) {
                if (callback) {
                    return callback({ id: null, error: error.errno }, {}, callback_params);
                }
            } else if (callback) {
                if ((res.statusCode === 200) || (res.statusCode === 201)) {
                    const safeValue = typeof value === 'string'
                        ? JSON.parse(value)
                        : value;

                    return callback(safeValue, res.headers, callback_params);
                }
                return callback({ id: null, error: `API response: ${res.statusCode} ${JSON.stringify(value)}` }, res.headers, callback_params);
            }
            return false;
        });
    }
}


module.exports = Client;
