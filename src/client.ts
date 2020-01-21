import Log from 'log';
import { EventEmitter } from 'events';
import Api from './api';
import Channel from './channel';
import Post from './post';
import Team from './team';
import User from './user';
import Websocket from './websocket';

const usersRoute = '/users';

class Client extends EventEmitter {
    host: string;

    group: string;

    options: any;

    useTLS: boolean;

    additionalHeaders: object;

    tlsverify: boolean;

    authenticated: boolean;

    hasAccessToken: boolean;

    token: string;

    httpProxy: any;

    logger: any;

    email: string;

    password: string;

    mfaToken: string;

    preferences: any;

    me: any;

    Api: Api;

    Channel: Channel;

    Post: Post;

    User: User;

    Team: Team;

    Websocket: Websocket;

    constructor(host: string, group: string, options: any) {
        super();

        this.host = host;
        this.group = group;
        this.options = options || { wssPort: 443, httpPort: 80 };
        this.additionalHeaders = {};

        this.useTLS = !(process.env.MATTERMOST_USE_TLS || '').match(/^false|0|no|off$/i);
        if (typeof options.useTLS !== 'undefined') {
            this.useTLS = options.useTLS;
        }
        this.tlsverify = !(process.env.MATTERMOST_TLS_VERIFY || '').match(/^false|0|no|off$/i);
        if (typeof options.tlsverify !== 'undefined') {
            this.tlsverify = options.tlsverify;
        }

        if (typeof options.additionalHeaders === 'object') {
            this.additionalHeaders = options.additionalHeaders;
        }

        this.authenticated = false;
        this.hasAccessToken = false;
        this.token = null;

        this.me = null;

        this.httpProxy = (this.options.httpProxy != null) ? this.options.httpProxy : false;

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

        if (typeof options.messageMaxRunes !== 'undefined') {
            this.Post.messageMaxRunes = options.messageMaxRunes;
        }
    }

    initModules(): any {
        this.Api = new Api(this);
        this.Channel = new Channel(this, usersRoute);
        this.Post = new Post(this);
        this.User = new User(this, usersRoute);
        this.Team = new Team(this, usersRoute);
        this.Websocket = new Websocket(this);
    }

    initBindings(): any {
        // Binding because async calls galore
        this._onLogin = this._onLogin.bind(this);
        this._onRevoke = this._onRevoke.bind(this);
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
                this.Websocket.reconnecting = false;
                return this.Websocket.reconnect();
            }
            this.authenticated = true;
            // Continue happy flow here
            if (!this.hasAccessToken) {
                this.token = headers.token;
                this.Api.token = headers.token;
            }
            this.Websocket.socketUrl = this.Websocket.getSocketUrl();
            this.logger.info(`Websocket URL: ${this.Websocket.socketUrl}`);
            this.me = data;
            this.emit('loggedIn', this.me);
            this.User.getMe();
            this.User.getPreferences();
            return this.Team.getTeams();
        }
        this.emit('error', data);
        this.authenticated = false;
        return this.Websocket.reconnect();
    }

    _onRevoke(data: any) {
        return this.emit('sessionRevoked', data);
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
}

export default Client;
