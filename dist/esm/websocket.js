import WebSocket from 'isomorphic-ws';
import HttpsProxyAgent from 'https-proxy-agent';
class Websocket {
    constructor(client) {
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
    connect() {
        if (this._connecting) {
            return;
        }
        this._connecting = true;
        this.client.logger.info('Connecting...');
        const options = { rejectUnauthorized: this._tlsverify };
        if (this._httpProxy) {
            options.agent = new HttpsProxyAgent(this._httpProxy);
        }
        if (this._ws) {
            this._ws.close();
            this._ws = null;
        }
        this._ws = new WebSocket(this._socketUrl, options);
        this._ws.on('error', (error) => {
            this._connecting = false;
            return this.client.emit('error', error);
        });
        this._ws.on('open', () => {
            this._connecting = false;
            this._reconnecting = false;
            this._connected = true;
            this.client.emit('connected');
            this._connAttempts = 0;
            this._lastPong = Date.now();
            const challenge = {
                action: 'authentication_challenge',
                data: {
                    token: this.client.Authentication.token,
                },
            };
            this.client.logger.info('Sending challenge...');
            this._send(challenge);
            this.client.logger.info('Starting pinger...');
            this._pongTimeout = setInterval(() => {
                if (!this._connected) {
                    this.client.logger.error('Not connected in pongTimeout');
                    this.reconnect();
                    return;
                }
                if (this._lastPong && (Date.now() - this._lastPong) > (2 * this._pingInterval)) {
                    this.client.logger.error('Last pong is too old: %d', (Date.now() - this._lastPong) / 1000);
                    this.client.Authentication.authenticated = false;
                    this._connected = false;
                    this.reconnect();
                    return;
                }
                this.client.logger.info('ping');
                this._send({ action: 'ping' });
            }, this._pingInterval);
            return this._pongTimeout;
        });
        this._ws.on('message', (data, _flags) => {
            this.onMessage(JSON.parse(data));
        });
        this._ws.on('close', (code, message) => {
            this.client.emit('close', code, message);
            this._connecting = false;
            this._connected = false;
            this._socketUrl = null;
            return this.reconnect();
        });
    }
    reconnect() {
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
            const timeout = this._connAttempts * 1000;
            this.client.logger.info('Reconnecting in %dms', timeout);
            return setTimeout(() => {
                this.client.logger.info('Attempting reconnect');
                if (this.client.hasAccessToken) {
                    return this.client.tokenLogin(this.client.Authentication.token);
                }
                return this.client.login(this.client.Authentication.authEmail, this.client.Authentication.authPassword, this.client.Authentication.mfaToken);
            }, timeout);
        }
        return false;
    }
    disconnect() {
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
    }
    onMessage(message) {
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
    }
    set reconnecting(value) {
        this._reconnecting = value;
    }
    set socketUrl(value) {
        this._socketUrl = value;
    }
    get useTLS() {
        return this._useTLS;
    }
    get tlsverify() {
        return this._tlsverify;
    }
    get httpProxy() {
        return this._httpProxy;
    }
    _send(message) {
        const messageExt = { ...message };
        if (!this._connected) {
            return false;
        }
        this._messageID += 1;
        messageExt.id = this._messageID;
        messageExt.seq = messageExt.id;
        this._pending[messageExt.id] = messageExt;
        this._ws.send(JSON.stringify(messageExt));
        return messageExt;
    }
    getSocketUrl() {
        const protocol = this.client.useTLS ? 'wss://' : 'ws://';
        const httpPort = this.client.options.httpPort ? `:${this.client.options.httpPort}` : '';
        const wssPort = this.client.useTLS && this.client.options.wssPort ? `:${this.client.options.wssPort}` : httpPort;
        return `${protocol + this.client.host + wssPort + this.apiPrefix}/websocket`;
    }
}
export default Websocket;
//# sourceMappingURL=websocket.js.map