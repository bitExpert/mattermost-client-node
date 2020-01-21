"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var log_1 = __importDefault(require("log"));
var events_1 = require("events");
var api_1 = __importDefault(require("./api"));
var authentication_1 = __importDefault(require("./authentication"));
var channel_1 = __importDefault(require("./channel"));
var post_1 = __importDefault(require("./post"));
var team_1 = __importDefault(require("./team"));
var user_1 = __importDefault(require("./user"));
var websocket_1 = __importDefault(require("./websocket"));
var usersRoute = '/users';
var Client = (function (_super) {
    __extends(Client, _super);
    function Client(host, team, options) {
        var _this = _super.call(this) || this;
        _this.me = null;
        _this.host = host;
        _this.team = team;
        _this.options = options || { wssPort: 443, httpPort: 80 };
        _this._setLogger();
        _this.initModules();
        process.env.LOG_LEVEL = process.env.MATTERMOST_LOG_LEVEL || 'info';
        return _this;
    }
    Client.prototype._setLogger = function () {
        if (typeof this.options.logger !== 'undefined') {
            switch (this.options.logger) {
                case 'noop':
                    this.logger = {
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
                    this.logger = this.options.logger;
                    break;
            }
        }
        else {
            this.logger = log_1.default;
        }
    };
    Client.prototype.initModules = function () {
        this.Api = new api_1.default(this);
        this.Authentication = new authentication_1.default(this, usersRoute);
        this.Channel = new channel_1.default(this, usersRoute);
        this.Post = new post_1.default(this);
        this.User = new user_1.default(this, usersRoute);
        this.Team = new team_1.default(this, usersRoute);
        this.Websocket = new websocket_1.default(this);
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
    return Client;
}(events_1.EventEmitter));
exports.default = Client;
//# sourceMappingURL=client.js.map