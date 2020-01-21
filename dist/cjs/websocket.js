"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var isomorphic_ws_1 = __importDefault(require("isomorphic-ws"));
var https_proxy_agent_1 = __importDefault(require("https-proxy-agent"));
var Websocket = (function () {
    function Websocket(client) {
        this.apiPrefix = '/api/v4';
        this._ws = null;
        this._useTLS = false;
        this._tlsverify = false;
        this._connected = false;
        this._connecting = false;
        this._reconnecting = false;
        this._connAttempts = 0;
        this._autoReconnect = true;
        this._pingInterval = 60000;
        this._messageID = 0;
        this._pending = {};
        this.client = client;
        if (this.client.options.pingInterval != null) {
            this._pingInterval = this.client.options.pingInterval;
        }
        if (this.client.options.autoReconnect != null) {
            this._autoReconnect = this.client.options.autoReconnect;
        }
        this._useTLS = !(process.env.MATTERMOST_USE_TLS || '').match(/^false|0|no|off$/i);
        if (typeof this.client.options.useTLS !== 'undefined') {
            this._useTLS = this.client.options.useTLS;
        }
        this._tlsverify = !(process.env.MATTERMOST_TLS_VERIFY || '').match(/^false|0|no|off$/i);
        if (typeof this.client.options.tlsverify !== 'undefined') {
            this._tlsverify = this.client.options.tlsverify;
        }
        this._httpProxy = (this.client.options.httpProxy != null)
            ? this.client.options.httpProxy
            : false;
    }
    Websocket.prototype.connect = function () {
        var _this = this;
        if (this._connecting) {
            return;
        }
        this._connecting = true;
        this.client.logger.info('Connecting...');
        var options = { rejectUnauthorized: this._tlsverify };
        if (this._httpProxy) {
            options.agent = new https_proxy_agent_1.default(this._httpProxy);
        }
        if (this._ws) {
            this._ws.close();
            this._ws = null;
        }
        this._ws = new isomorphic_ws_1.default(this._socketUrl, options);
        this._ws.on('error', function (error) {
            _this._connecting = false;
            return _this.client.emit('error', error);
        });
        this._ws.on('open', function () {
            _this._connecting = false;
            _this._reconnecting = false;
            _this._connected = true;
            _this.client.emit('connected');
            _this._connAttempts = 0;
            _this._lastPong = Date.now();
            var challenge = {
                action: 'authentication_challenge',
                data: {
                    token: _this.client.Authentication.token,
                },
            };
            _this.client.logger.info('Sending challenge...');
            _this._send(challenge);
            _this.client.logger.info('Starting pinger...');
            _this._pongTimeout = setInterval(function () {
                if (!_this._connected) {
                    _this.client.logger.error('Not connected in pongTimeout');
                    _this.reconnect();
                    return;
                }
                if (_this._lastPong && (Date.now() - _this._lastPong) > (2 * _this._pingInterval)) {
                    _this.client.logger.error('Last pong is too old: %d', (Date.now() - _this._lastPong) / 1000);
                    _this.client.Authentication.authenticated = false;
                    _this._connected = false;
                    _this.reconnect();
                    return;
                }
                _this.client.logger.info('ping');
                _this._send({ action: 'ping' });
            }, _this._pingInterval);
            return _this._pongTimeout;
        });
        this._ws.on('message', function (data, _flags) {
            _this.onMessage(JSON.parse(data));
        });
        this._ws.on('close', function (code, message) {
            _this.client.emit('close', code, message);
            _this._connecting = false;
            _this._connected = false;
            _this._socketUrl = null;
            return _this.reconnect();
        });
    };
    Websocket.prototype.reconnect = function () {
        var _this = this;
        if (this._autoReconnect) {
            if (this._reconnecting) {
                this.client.logger.info('WARNING: Already reconnecting.');
            }
            this._connecting = false;
            this._reconnecting = true;
            if (this._pongTimeout) {
                clearInterval(this._pongTimeout);
                this._pongTimeout = null;
            }
            this.client.Authentication.authenticated = false;
            if (this._ws) {
                this._ws.close();
            }
            this._connAttempts += 1;
            var timeout = this._connAttempts * 1000;
            this.client.logger.info('Reconnecting in %dms', timeout);
            return setTimeout(function () {
                _this.client.logger.info('Attempting reconnect');
                if (_this.client.hasAccessToken) {
                    return _this.client.tokenLogin(_this.client.Authentication.token);
                }
                return _this.client.login(_this.client.Authentication.authEmail, _this.client.Authentication.authPassword, _this.client.Authentication.mfaToken);
            }, timeout);
        }
        return false;
    };
    Websocket.prototype.disconnect = function () {
        if (!this._connected) {
            return false;
        }
        this._autoReconnect = false;
        if (this._pongTimeout) {
            clearInterval(this._pongTimeout);
            this._pongTimeout = null;
        }
        this._ws.close();
        return true;
    };
    Websocket.prototype.onMessage = function (message) {
        this.client.emit('raw_message', message);
        switch (message.event) {
            case 'ping':
                this.client.logger.info('ACK ping');
                this._lastPong = Date.now();
                return this.client.emit('ping', message);
            case 'posted':
                return this.client.emit('message', message);
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
                return this.client.emit(message.event, message);
            case 'new_user':
                this.client.User.loadUser(message.data.user_id);
                return this.client.emit('new_user', message);
            default:
                if ((message.data ? message.data.text : undefined)
                    && (message.data.text === 'pong')) {
                    this.client.logger.info('ACK ping (2)');
                    this.client._lastPong = Date.now();
                    return this.client.emit('ping', message);
                }
                this.client.logger.debug('Received unhandled message:');
                return this.client.logger.debug(message);
        }
    };
    Object.defineProperty(Websocket.prototype, "reconnecting", {
        set: function (value) {
            this._reconnecting = value;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Websocket.prototype, "socketUrl", {
        set: function (value) {
            this._socketUrl = value;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Websocket.prototype, "useTLS", {
        get: function () {
            return this._useTLS;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Websocket.prototype, "tlsverify", {
        get: function () {
            return this._tlsverify;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Websocket.prototype, "httpProxy", {
        get: function () {
            return this._httpProxy;
        },
        enumerable: true,
        configurable: true
    });
    Websocket.prototype._send = function (message) {
        var messageExt = __assign({}, message);
        if (!this._connected) {
            return false;
        }
        this._messageID += 1;
        messageExt.id = this._messageID;
        messageExt.seq = messageExt.id;
        this._pending[messageExt.id] = messageExt;
        this._ws.send(JSON.stringify(messageExt));
        return messageExt;
    };
    Websocket.prototype.getSocketUrl = function () {
        var protocol = this.client.useTLS ? 'wss://' : 'ws://';
        var httpPort = this.client.options.httpPort ? ":" + this.client.options.httpPort : '';
        var wssPort = this.client.useTLS && this.client.options.wssPort ? ":" + this.client.options.wssPort : httpPort;
        return protocol + this.client.host + wssPort + this.apiPrefix + "/websocket";
    };
    return Websocket;
}());
exports.default = Websocket;
//# sourceMappingURL=websocket.js.map