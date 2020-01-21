import Log from 'log';
import { EventEmitter } from 'events';
import Api from './api';
import Authentication from './authentication';
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

    additionalHeaders: object;

    httpProxy: any;

    logger: any;

    email: string;

    password: string;

    preferences: any;

    me: any;

    Api: Api;

    Authentication: Authentication;

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

        if (typeof options.additionalHeaders === 'object') {
            this.additionalHeaders = options.additionalHeaders;
        }

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

        if (typeof options.messageMaxRunes !== 'undefined') {
            this.Post.messageMaxRunes = options.messageMaxRunes;
        }
    }

    initModules(): any {
        this.Api = new Api(this);
        this.Authentication = new Authentication(this, usersRoute);
        this.Channel = new Channel(this, usersRoute);
        this.Post = new Post(this);
        this.User = new User(this, usersRoute);
        this.Team = new Team(this, usersRoute);
        this.Websocket = new Websocket(this);
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
