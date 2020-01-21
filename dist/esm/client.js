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
    constructor(host, team, options) {
        super();
        this.me = null;
        this.host = host;
        this.team = team;
        this.options = options || { wssPort: 443, httpPort: 80 };
        this._setLogger();
        this.initModules();
        process.env.LOG_LEVEL = process.env.MATTERMOST_LOG_LEVEL || 'info';
    }
    _setLogger() {
        if (typeof this.options.logger !== 'undefined') {
            switch (this.options.logger) {
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
                    this.logger = this.options.logger;
                    break;
            }
        }
        else {
            this.logger = Log;
        }
    }
    initModules() {
        this.Api = new Api(this);
        this.Authentication = new Authentication(this, usersRoute);
        this.Channel = new Channel(this, usersRoute);
        this.Post = new Post(this);
        this.User = new User(this, usersRoute);
        this.Team = new Team(this, usersRoute);
        this.Websocket = new Websocket(this);
    }
    dialog(triggerId, url, dialog) {
        const postData = {
            trigger_id: triggerId,
            url,
            dialog,
        };
        return this.Api.apiCall('POST', '/actions/dialogs/open', postData, (_data, _headers) => {
            this.logger.debug('Created dialog');
        });
    }
}
export default Client;
//# sourceMappingURL=client.js.map