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
    host: string;

    group: string;

    options: any;

    useTLS: boolean;

    messageMaxRunes: number;

    tlsverify: boolean;

    authenticated: boolean;

    connected: boolean;

    hasAccessToken: boolean;

    token: any;

    self: any;

    channels: any;

    users: any;

    teams: any;

    teamID: any;

    ws: any;

    _messageID: number;

    _pending: any;

    _pingInterval: any;

    autoReconnect: any;

    httpProxy: any;

    _connecting: boolean;

    _reconnecting: boolean;

    _connAttempts: number;

    logger: any;

    email: string;

    password: string;

    mfaToken: string;

    socketUrl: string;

    preferences: any;

    me: any;

    _lastPong: number;

    _pongTimeout: NodeJS.Timeout;

    getAllUsers: () => any;

    constructor(host: string, group: string, options: any) {
        super();

        this.host = host;
        this.group = group;
        this.options = options || { wssPort: 443, httpPort: 80 };
        this.messageMaxRunes = 4000;

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
                    debug: () => {},
                    info: () => {},
                    notice: () => {},
                    warning: () => {},
                    error: () => {},
                };
                break;
            default:
                this.logger = options.logger;
                break;
            }
        } else {
            this.logger = Log;
        }

        // Binding because async calls galore
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

    login(email: string, password: string, mfaToken: string) {
        this.hasAccessToken = false;
        this.email = email;
        this.password = password;
        this.mfaToken = mfaToken;
        this.logger.info('Logging in...');
        return this._apiCall(
            'POST',
            `${usersRoute}/login`,
            {
                // eslint-disable-next-line @typescript-eslint/camelcase
                login_id: this.email,
                password: this.password,
                token: this.mfaToken,
            },
            this._onLogin,
        );
    }

    // revoke a user session
    revoke(userID: string) {
        return this._apiCall('POST', `${usersRoute}/${userID}/sessions/revoke`, {}, this._onRevoke);
    }

    createUser(user: User) {
        const uri = `${usersRoute}?iid=`;
        return this._apiCall('POST', uri, user, this._onCreateUser);
    }

    // eslint-disable-next-line @typescript-eslint/camelcase
    createTeam(name: string, display_name: string, type = 'I') {
        const uri = '/teams';
        // eslint-disable-next-line @typescript-eslint/camelcase
        return this._apiCall('POST', uri, { name, display_name, type }, this._onCreateTeam);
    }

    checkIfTeamExists(teamName: string) {
        const uri = `/teams/name/${teamName}/exists`;
        return this._apiCall('GET', uri, null, this._onCheckIfTeamExists);
    }

    // eslint-disable-next-line @typescript-eslint/camelcase
    addUserToTeam(user_id: string, team_id: string) {
        const postData = {
            // eslint-disable-next-line @typescript-eslint/camelcase
            team_id,
            // eslint-disable-next-line @typescript-eslint/camelcase
            user_id,
        };
        // eslint-disable-next-line @typescript-eslint/camelcase
        const uri = `/teams/${team_id}/members`;
        return this._apiCall('POST', uri, postData, this._onAddUserToTeam);
    }


    tokenLogin(token: string) {
        this.token = token;
        this.hasAccessToken = true;
        this.logger.info('Logging in with personal access token...');
        const uri = `${usersRoute}/me`;
        return this._apiCall('GET', uri, null, this._onLogin);
    }

    _onLogin(data: any, headers: any) {
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

    _onRevoke(data: any) {
        return this.emit('sessionRevoked', data);
    }

    _onCreateTeam(data: any) {
        if (!data.error) {
            this.logger.info('Creating team...');
            return this.emit('teamCreated', data);
        }
        this.logger.error('Team creation failed', JSON.stringify(data));
        return this.emit('error', data);
    }

    _onCheckIfTeamExists(data: any) {
        if (!data.error) {
            this.logger.info('Checking if team exists...');
            return this.emit('teamChecked', data);
        }
        this.logger.error('An error occured while checking if team exists: ', JSON.stringify(data));
        return this.emit('error', data);
    }

    _onAddUserToTeam(data: any) {
        if (!data.error) {
            this.logger.info('Adding user to team...');
            return this.emit('userAdded', data);
        }
        this.logger.error('An error occured while adding user to team: ', JSON.stringify(data));
        return this.emit('error', data);
    }

    _onCreateUser(data: any) {
        if (data.id) {
            this.logger.info('Creating user...');
            return this.emit('created', data);
        }
        this.logger.error('User creation failed', JSON.stringify(data));
        return this.emit('error', data);
    }

    _onLoadUsers(data: User[] | any, _headers: any, params: any) {
        if (data && !data.error) {
            data.forEach((user: User) => {
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

    _onLoadUser(data: any, _headers: any, _params: any) {
        if (data && !data.error) {
            this.users[data.id] = data;
            return this.emit('profilesLoaded', [data]);
        }
        return this.emit('error', { msg: 'data missing or incorrect' });
    }

    _onChannels(data: any, _headers: any, _params: any) {
        if (data && !data.error) {
            data.forEach((channel: Channel) => {
                this.channels[channel.id] = channel;
            });
            this.logger.info(`Found ${Object.keys(data).length} subscribed channels.`);
            return this.emit('channelsLoaded', data);
        }
        this.logger.error(`Failed to get subscribed channels list from server: ${data.error}`);
        return this.emit('error', { msg: 'failed to get channel list' });
    }

    _onUsersOfChannel(data: any, _headers: any, _params: any) {
        if (data && !data.error) {
            Object.entries(data).forEach((channel: any) => {
                this.channels[channel.id] = channel;
            });
            this.logger.info(`Found ${Object.keys(data).length} subscribed channels.`);
            return this.emit('usersOfChannelLoaded', data);
        }
        this.logger.error(`Failed to get subscribed channels list from server: ${data.error}`);
        return this.emit('error', { msg: 'failed to get channel list' });
    }

    _onMessages(data: any, _headers: any, _params: any) {
        if (data && !data.error) {
            this.logger.info(`Found ${Object.keys(data).length} subscribed channels.`);
            return this.emit('messagesLoaded', data);
        }
        this.logger.error(`Failed to get messages from server: ${data.error}`);
        return this.emit('error', { msg: 'failed to get messages' });
    }

    _onUnreadsForChannels(data: any, _headers: any, _params: any) {
        if (data && !data.error) {
            this.logger.info(`Found ${Object.keys(data).length} information about unreads.`);
            return this.emit('channelsUnreadsLoaded', data);
        }
        this.logger.error(`Failed to get unreads of channels from server: ${data.error}`);
        return this.emit('error', { msg: 'failed to get unreads for channels' });
    }

    _onChannelLastViewed(data: any, _headers: any, _params: any) {
        if (data && !data.error) {
            this.logger.info(`Found ${Object.keys(data).length} for last reads.`);
            return this.emit('channelLastViewedLoaded', data);
        }
        this.logger.error(`Failed to get last reads of channel(s) from server: ${data.error}`);
        return this.emit('error', { msg: 'failed to get last reads for channel(s)' });
    }

    _onMembersFromChannels(data: any, _headers: any, _params: any) {
        if (data && !data.error) {
            this.logger.info(`Found ${Object.keys(data).length} channels.`);
            return this.emit('membersFromChannelsLoaded', data);
        }
        this.logger.error(`Failed to get messages from server: ${data.error}`);
        return this.emit('error', { msg: 'failed to get all members from channels' });
    }

    _onPreferences(data: any, _headers: any, _params: any) {
        if (data && !data.error) {
            this.preferences = data;
            this.emit('preferencesLoaded', data);
            return this.logger.info('Loaded Preferences...');
        }
        this.logger.error(`Failed to load Preferences...${data.error}`);
        return this.reconnect();
    }

    _onMe(data: any, _headers: any, _params: any) {
        if (data && !data.error) {
            this.me = data;
            this.emit('meLoaded', data);
            return this.logger.info('Loaded Me...');
        }
        this.logger.error(`Failed to load Me...${data.error}`);
        return this.reconnect();
    }

    _onTeams(data: any, _headers: any, _params: any) {
        if (data && !data.error) {
            this.teams = data;
            this.emit('teamsLoaded', data);
            // do not go further if user is not added to a team
            if (!data.length) {
                return this.teams;
            }
            this.logger.info(`Found ${Object.keys(this.teams).length} teams.`);
            this.teams
                .find((team: any) => {
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

    _onTeamsByName(data: any, _headers: any, _params: any) {
        if (data && !data.error) {
            this.logger.info(`Found ${Object.keys(data).length} channels.`);
            return this.emit('teamsByNameLoaded', data);
        }
        this.logger.error(`Failed to get team by name from server: ${data.error}`);
        return this.emit('error', { msg: 'failed to get team by name' });
    }

    channelRoute(channelId: string) {
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

    getTeamByName(teamName: string) {
        const uri = `/teams/name/${teamName}`;
        this.logger.info(`Loading ${uri}`);
        return this._apiCall('GET', uri, null, this._onTeamsByName);
    }

    loadUsers(page = 0, byTeam = true) {
        let uri = `/users?page=${page}&per_page=200`;
        // get only users of team (surveybot NOT included)
        if (byTeam) {
            uri += `&in_team=${this.teamID}`;
        }
        this.logger.info(`Loading ${uri}`);
        return this._apiCall('GET', uri, null, this._onLoadUsers, { page });
    }

    loadUser(userId: string) {
        const uri = `/users/${userId}`;
        this.logger.info(`Loading ${uri}`);
        return this._apiCall('GET', uri, null, this._onLoadUser, {});
    }

    loadChannels() {
        const uri = `/users/me/teams/${this.teamID}/channels`;
        this.logger.info(`Loading ${uri}`);
        return this._apiCall('GET', uri, null, this._onChannels);
    }

    loadUsersFromChannel(channelId: string) {
        const uri = `/channels/${channelId}/members`;
        this.logger.info(`Loading ${uri}`);
        return this._apiCall('GET', uri, null, this._onUsersOfChannel);
    }

    loadMessagesFromChannel(channelId: string, options: any = {}) {
        let uri = `/channels/${channelId}/posts`;
        const allowedOptions = ['page', 'per_page', 'since', 'before', 'after'];
        const params: any = {};
        Object.entries(options).forEach((option: any) => {
            const key = option[0];
            const value = option[1];
            if (allowedOptions.indexOf(key) >= 0) {
                params[key] = value;
            }
        });
        // set standard params for page / per_page if not set
        if (!params.page) {
            params.page = 0;
        }
        if (!params.per_page) {
            // eslint-disable-next-line @typescript-eslint/camelcase
            params.per_page = 30;
        }
        uri += `?${querystring.stringify(params)}`;
        this.logger.info(`Loading ${uri}`);
        return this._apiCall('GET', uri, params, this._onMessages);
    }

    // to mark messages as read (e.g. after loading messages of channel)
    // trigger loadChannelLastViewed method
    loadChannelLastViewed(channelId: string, prevChannelId: string | null = null) {
        const postData = {
            // eslint-disable-next-line @typescript-eslint/camelcase
            channel_id: channelId,
            // eslint-disable-next-line @typescript-eslint/camelcase
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
        const options: any = { rejectUnauthorized: this.tlsverify };

        if (this.httpProxy) { options.agent = new HttpsProxyAgent(this.httpProxy); }

        // Set up websocket connection to server
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.ws = new WebSocket(this.socketUrl, options);

        this.ws.on('error', (error: any) => {
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

        this.ws.on('message', (data: any, _flags: any) => {
            this.onMessage(JSON.parse(data));
        });

        this.ws.on('close', (code: any, message: any) => {
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

    onMessage(message: any) {
        this.emit('raw_message', message);
        switch (message.event) {
        case 'ping':
            // Deprecated
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

    getUserDirectMessageChannel(userID: string, callback: any) {
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

    getAllChannels(): Record<string, any> {
        return this.channels;
    }

    getChannelByID(id: string): Record<string, any> {
        return this.channels[id];
    }

    getUserByID(id: string): Record<string, any> {
        return this.users[id];
    }

    getUserByEmail(email: string): Record<string, any> {
        return Object.values(this.users)
            .find((user: any) => user.email === email);
    }

    customMessage(postData: any, channelID: string) {
        let chunks: any;
        const postDataExt = { ...postData };
        if (postDataExt.message != null) {
            chunks = this._chunkMessage(postData.message);
            postDataExt.message = chunks.shift();
        }
        // eslint-disable-next-line @typescript-eslint/camelcase
        postDataExt.channel_id = channelID;
        return this._apiCall('POST', '/posts', postData, (_data: any, _headers: any) => {
            this.logger.debug('Posted custom message.');
            if ((chunks != null ? chunks.length : undefined) > 0) {
                this.logger.debug(`Recursively posting remainder of customMessage: (${chunks.length})`);
                postDataExt.message = chunks.join();
                return this.customMessage(postData, channelID);
            }
            return true;
        });
    }

    dialog(triggerId: string, url: string, dialog: any) {
        const postData = {
            // eslint-disable-next-line @typescript-eslint/camelcase
            trigger_id: triggerId,
            url,
            dialog,
        };
        return this._apiCall(
            'POST',
            '/actions/dialogs/open',
            postData,
            (_data: any, _headers: any) => {
                this.logger.debug('Created dialog');
            },
        );
    }

    editPost(postId: string, msg: any) {
        let postData: any = msg;
        if (typeof msg === 'string') {
            postData = {
                id: postId,
                message: msg,
            };
        }
        return this._apiCall('PUT', `/posts/${postId}`, postData, (_data: any, _headers: any) => {
            this.logger.debug('Edited post');
        });
    }

    uploadFile(channelId: string, file: any, callback: any) {
        const formData = {
            // eslint-disable-next-line @typescript-eslint/camelcase
            channel_id: channelId,
            files: file,
        };

        return this._apiCall(
            'POST',
            '/files',
            formData,
            (data: any, _headers: any) => {
                this.logger.debug('Posted file');
                return callback(data);
            },
            {},
            true,
        );
    }

    react(messageID: string, emoji: string) {
        const postData = {
            // eslint-disable-next-line @typescript-eslint/camelcase
            user_id: this.self.id,
            // eslint-disable-next-line @typescript-eslint/camelcase
            post_id: messageID,
            // eslint-disable-next-line @typescript-eslint/camelcase
            emoji_name: emoji,
            // eslint-disable-next-line @typescript-eslint/camelcase
            create_at: 0,
        };
        return this._apiCall('POST', '/reactions', postData, (_data: any, _headers: any) => {
            this.logger.debug('Created reaction');
        });
    }

    unreact(messageID: string, emoji: string) {
        const uri = `/users/me/posts/${messageID}/reactions/${emoji}`;
        return this._apiCall('DELETE', uri, [], (_data: any, _headers: any) => {
            this.logger.debug('Deleted reaction');
        });
    }

    // type "D"
    createDirectChannel(userID: string, callback: any) {
        const postData = [userID, this.self.id];
        return this._apiCall(
            'POST',
            '/channels/direct',
            postData,
            (data: any, _headers: any) => {
                this.logger.info('Created Direct Channel.');
                return (callback != null) ? callback(data) : false;
            },
        );
    }

    // type "G"
    createGroupChannel(userIDs: string, callback: any) {
        return this._apiCall(
            'POST',
            '/channels/group',
            userIDs,
            (data: any, _headers: any) => {
                this.logger.info('Created Group Channel.');
                return (callback != null) ? callback(data) : false;
            },
        );
    }

    // type "P"
    createPrivateChannel(privateChannel: any, callback: any) {
        return this._apiCall(
            'POST',
            '/channels',
            privateChannel,
            (data: any, _headers: any) => {
                this.logger.info('Created Private Channel.');
                return (callback != null) ? callback(data) : false;
            },
        );
    }

    addUserToChannel(privateChannel: any, callback: any) {
        const uri = `/channels/${privateChannel.channel_id}/members`;
        return this._apiCall(
            'POST',
            uri,
            privateChannel,
            (data: any, _headers: any) => {
                this.logger.info(`Added User to Channel${privateChannel.channel_id}`);
                return (callback != null) ? callback(data) : false;
            },
        );
    }

    findChannelByName(name: string): string | null {
        const foundChannel = Object.keys(this.channels)
            .find((channel: any) => {
                const channelName = this.channels[channel].name;
                const channelDisplayName = this.channels[channel].display_name;
                return channelName === name || channelDisplayName === name;
            });
        return foundChannel || null;
    }

    _chunkMessage(msg: any): Array<string> {
        if (!msg) {
            return [''];
        }
        return msg.match(new RegExp(`(.|[\r\n]){1,${this.messageMaxRunes}}`, 'g'));
    }

    postMessage(msg: any, channelID: string) {
        const postData: any = {
            message: msg,
            // eslint-disable-next-line @typescript-eslint/camelcase
            file_ids: [],
            // eslint-disable-next-line @typescript-eslint/camelcase
            create_at: 0,
            // eslint-disable-next-line @typescript-eslint/camelcase
            user_id: this.self.id,
            // eslint-disable-next-line @typescript-eslint/camelcase
            channel_id: channelID,
        };

        if (typeof msg === 'string') {
            postData.message = msg;
        } else {
            postData.message = msg.message;
            if (msg.props) {
                postData.props = msg.props;
            }
            // eslint-disable-next-line @typescript-eslint/camelcase
            if (msg.file_ids) {
                // eslint-disable-next-line @typescript-eslint/camelcase
                postData.file_ids = msg.file_ids;
            }
        }

        // break apart long messages
        const chunks = this._chunkMessage(postData.message);
        postData.message = chunks.shift();

        return this._apiCall('POST', '/posts', postData, (_data: any, _headers: any) => {
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

    setChannelHeader(channelID: string, header: any) {
        const postData = {
            // eslint-disable-next-line @typescript-eslint/camelcase
            channel_id: channelID,
            // eslint-disable-next-line @typescript-eslint/camelcase
            channel_header: header,
        };

        return this._apiCall(
            'POST',
            `${this.teamRoute()}/channels/update_header`,
            postData,
            (_data: any, _headers: any) => {
                this.logger.debug('Channel header updated.');
                return true;
            },
        );
    }

    // Private functions
    //
    _send(message: any): any {
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


    _apiCall(
        method: string,
        path: string,
        params: any,
        callback: any,
        callbackParams: any = {},
        isForm = false,
    ) {
        let postData = '';
        if (params != null) { postData = JSON.stringify(params); }
        const options: any = {
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

        if (this.token) { options.headers.Authorization = `BEARER ${this.token}`; }
        if (this.httpProxy) { options.proxy = this.httpProxy; }

        if (isForm) {
            options.headers['Content-Type'] = 'multipart/form-data';
            delete options.headers['Content-Length'];
            delete options.json;
            options.formData = params;
        }

        this.logger.debug(`${method} ${path}`);
        this.logger.info(`api url:${options.uri}`);

        return request(options, (error: any, res: any, value: any) => {
            if (error) {
                if (callback) {
                    return callback({ id: null, error: error.errno }, {}, callbackParams);
                }
            } else if (callback) {
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

    _getApiUrl(path: string): string {
        const protocol = this.useTLS ? 'https://' : 'http://';
        const port = (this.options.httpPort != null) ? `:${this.options.httpPort}` : '';
        return protocol + this.host + port + apiPrefix + path;
    }
}

export default Client;
