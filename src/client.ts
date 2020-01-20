import WebSocket from 'isomorphic-ws';
import Log from 'log';
import querystring from 'querystring';
import { EventEmitter } from 'events';
import HttpsProxyAgent from 'https-proxy-agent';
import User from './user';
import Api from './api';
import Team from './team';
import Channel from './channel';

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

    Channel: Channel;

    User: User;

    Team: Team;

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
        this.Channel = new Channel(this, usersRoute);
        this.User = new User(this, usersRoute);
        this.Team = new Team(this, usersRoute);
    }

    initBindings() {
        // Binding because async calls galore

        this._onLogin = this._onLogin.bind(this);
        this._onRevoke = this._onRevoke.bind(this);
        this._onMessages = this._onMessages.bind(this);
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
            return this.Team.getTeams();
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

    _onMessages(data: any, _headers: any, _params: any) {
        if (data && !data.error) {
            this.logger.info(`Found ${Object.keys(data).length} messages.`);
            return this.emit('messagesLoaded', data);
        }
        this.logger.error(`Failed to get messages from server: ${data.error}`);
        return this.emit('error', { msg: 'failed to get messages' });
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

    disconnect(): boolean {
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

    onMessage(message: any): any {
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
