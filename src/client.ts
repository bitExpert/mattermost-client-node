import WebSocket from 'isomorphic-ws';
import Log from 'log';
import querystring from 'querystring';
import { EventEmitter } from 'events';
import HttpsProxyAgent from 'https-proxy-agent';
import User from './user';
import Api from './api';

const apiPrefix = '/api/v4';
const usersRoute = '/users';
const defaultPingInterval = 60000;

class Client extends EventEmitter {
    host: string;

    group: string;

    options: any;

    useTLS: boolean;

    messageMaxRunes: number;

    additionalHeaders: object;

    tlsverify: boolean;

    authenticated: boolean;

    connected: boolean;

    hasAccessToken: boolean;

    token: string;

    self: any;

    channels: any;

    teams: any;

    teamID: string;

    ws: any;

    _messageID: number;

    _pending: any;

    _pingInterval: any;

    autoReconnect: boolean;

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

    Api: Api;

    User: User;

    constructor(host: string, group: string, options: any) {
        super();

        this.host = host;
        this.group = group;
        this.options = options || { wssPort: 443, httpPort: 80 };
        this.messageMaxRunes = 4000;
        this.additionalHeaders = {};

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
                        // do nothing
                    },
                    info: () => {
                        // do nothing
                    },
                    notice: () => {
                        // do nothing
                    },
                    warning: () => {
                        // do nothing
                    },
                    error: () => {
                        // do nothing
                    },
                };
                break;
            default:
                this.logger = options.logger;
                break;
            }
        } else {
            this.logger = Log;
        }

        this.initModules();
        this.initBindings();
    }

    initModules() {
        this.Api = new Api(this);
        this.User = new User(this, usersRoute);
    }

    initBindings() {
        // Binding because async calls galore

        this._onLogin = this._onLogin.bind(this);
        this._onCreateTeam = this._onCreateTeam.bind(this);
        this._onCheckIfTeamExists = this._onCheckIfTeamExists.bind(this);
        this._onRevoke = this._onRevoke.bind(this);
        this._onAddUserToTeam = this._onAddUserToTeam.bind(this);
        this._onChannels = this._onChannels.bind(this);
        this._onUsersOfChannel = this._onUsersOfChannel.bind(this);
        this._onMessages = this._onMessages.bind(this);
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
        return this.Api.apiCall(
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
        return this.Api.apiCall('POST', `${usersRoute}/${userID}/sessions/revoke`, {}, this._onRevoke);
    }

    // eslint-disable-next-line @typescript-eslint/camelcase
    createTeam(name: string, display_name: string, type = 'I') {
        const uri = '/teams';
        // eslint-disable-next-line @typescript-eslint/camelcase
        return this.Api.apiCall('POST', uri, { name, display_name, type }, this._onCreateTeam);
    }

    checkIfTeamExists(teamName: string) {
        const uri = `/teams/name/${teamName}/exists`;
        return this.Api.apiCall('GET', uri, null, this._onCheckIfTeamExists);
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
        return this.Api.apiCall('POST', uri, postData, this._onAddUserToTeam);
    }

    tokenLogin(token: string) {
        this.token = token;
        this.Api.token = token;
        this.hasAccessToken = true;
        this.logger.info('Logging in with personal access token...');
        const uri = `${usersRoute}/me`;
        return this.Api.apiCall('GET', uri, null, this._onLogin);
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
                this.Api.token = headers.token;
            }
            this.socketUrl = this._getSocketUrl();
            this.logger.info(`Websocket URL: ${this.socketUrl}`);
            this.self = data;
            this.emit('loggedIn', this.self);
            this.User.getMe();
            this.User.getPreferences();
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

    _onChannels(data: any, _headers: any, _params: any) {
        if (data && !data.error) {
            data.forEach((channel: IChannel) => {
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
            this.logger.info(`Found ${Object.keys(data).length} users.`);
            return this.emit('usersOfChannelLoaded', data);
        }
        this.logger.error(`Failed to get channel users from server: ${data.error}`);
        return this.emit('error', { msg: 'failed to get channel users' });
    }

    _onMessages(data: any, _headers: any, _params: any) {
        if (data && !data.error) {
            this.logger.info(`Found ${Object.keys(data).length} messages.`);
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
            this.User.loadUsers();
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

    getTeams() {
        const uri = `${usersRoute}/me/teams`;
        this.logger.info(`Loading ${uri}`);
        return this.Api.apiCall('GET', uri, null, this._onTeams);
    }

    getTeamByName(teamName: string) {
        const uri = `/teams/name/${teamName}`;
        this.logger.info(`Loading ${uri}`);
        return this.Api.apiCall('GET', uri, null, this._onTeamsByName);
    }

    loadChannels() {
        const uri = `/users/me/teams/${this.teamID}/channels`;
        this.logger.info(`Loading ${uri}`);
        return this.Api.apiCall('GET', uri, null, this._onChannels);
    }

    loadUsersFromChannel(channelId: string) {
        const uri = `/channels/${channelId}/members`;
        this.logger.info(`Loading ${uri}`);
        return this.Api.apiCall('GET', uri, null, this._onUsersOfChannel);
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
        return this.Api.apiCall('GET', uri, params, this._onMessages);
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
        return this.Api.apiCall('POST', uri, postData, this._onChannelLastViewed);
    }

    loadUnreadsForChannels() {
        const uri = '/users/me/teams/unread';
        this.logger.info(`Loading ${uri}`);
        return this.Api.apiCall('GET', uri, null, this._onUnreadsForChannels);
    }


    // method is needed e.g. to get detailed unreads (channels and direct messages)
    // iterate over this.channels and substract msg_count (result from this call)
    // from this.channels.total_msg_count
    loadMembersFromChannels() {
        const uri = `/users/me/teams/${this.teamID}/channels/members`;
        this.logger.info(`Loading ${uri}`);
        return this.Api.apiCall('GET', uri, null, this._onMembersFromChannels);
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
            this.User.loadUser(message.data.user_id);
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

    customMessage(postData: any, channelID: string) {
        let chunks: any;
        const postDataExt = { ...postData };
        if (postDataExt.message != null) {
            chunks = this._chunkMessage(postData.message);
            postDataExt.message = chunks.shift();
        }
        // eslint-disable-next-line @typescript-eslint/camelcase
        postDataExt.channel_id = channelID;
        return this.Api.apiCall('POST', '/posts', postData, (_data: any, _headers: any) => {
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
        return this.Api.apiCall(
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
        return this.Api.apiCall('PUT', `/posts/${postId}`, postData, (_data: any, _headers: any) => {
            this.logger.debug('Edited post');
        });
    }

    uploadFile(channelId: string, file: any, callback: any) {
        const formData = {
            // eslint-disable-next-line @typescript-eslint/camelcase
            channel_id: channelId,
            files: file,
        };

        return this.Api.apiCall(
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
        return this.Api.apiCall('POST', '/reactions', postData, (_data: any, _headers: any) => {
            this.logger.debug('Created reaction');
        });
    }

    unreact(messageID: string, emoji: string) {
        const uri = `/users/me/posts/${messageID}/reactions/${emoji}`;
        return this.Api.apiCall('DELETE', uri, [], (_data: any, _headers: any) => {
            this.logger.debug('Deleted reaction');
        });
    }

    // type "D"
    createDirectChannel(userID: string, callback: any) {
        const postData = [userID, this.self.id];
        return this.Api.apiCall(
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
        return this.Api.apiCall(
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
        return this.Api.apiCall(
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
        return this.Api.apiCall(
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

        return this.Api.apiCall('POST', '/posts', postData, (_data: any, _headers: any) => {
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

        return this.Api.apiCall(
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
}

export default Client;
