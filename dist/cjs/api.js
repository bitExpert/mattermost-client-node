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
var text_encoding_1 = __importDefault(require("text-encoding"));
var node_fetch_1 = __importDefault(require("node-fetch"));
var apiPrefix = '/api/v4';
var Api = (function () {
    function Api(client) {
        this._additionalHeaders = {};
        this.client = client;
        if (typeof this.client.options.additionalHeaders === 'object') {
            this._additionalHeaders = this.client.options.additionalHeaders;
        }
    }
    Api.prototype.apiCall = function (method, path, body, callback, callbackParams, isForm) {
        if (callbackParams === void 0) { callbackParams = {}; }
        if (isForm === void 0) { isForm = false; }
        var postData = '';
        var res;
        if (body != null) {
            postData = JSON.stringify(body);
        }
        var payload = {
            path: this._getApiUrl(path),
            options: {
                method: method,
                body: body,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': new text_encoding_1.default.TextEncoder('utf-8').encode(postData).length,
                    'X-Requested-With': 'XMLHttpRequest',
                },
            },
        };
        if (this._additionalHeaders) {
            payload.options.headers = Object.assign(payload.options.headers, __assign({}, this._additionalHeaders));
        }
        if (this.client.Authentication.token) {
            payload.options.headers.Authorization = "BEARER " + this.client.Authentication.token;
        }
        if (this.client.Websocket.httpProxy) {
            payload.options.proxy = this.client.Websocket.httpProxy;
        }
        if (isForm) {
            payload.options.headers['Content-Type'] = 'multipart/form-data';
            delete payload.options.headers['Content-Length'];
        }
        this.client.logger.debug(method + " " + path);
        this.client.logger.info("api url:" + payload.path);
        return node_fetch_1.default(payload.path, payload.options)
            .then(function (rawResponse) {
            res = rawResponse;
            return rawResponse.json();
        })
            .then(function (json) {
            if (callback) {
                if ((res.status === 200) || (res.status === 201)) {
                    return callback(json, res.headers, callbackParams);
                }
                return callback({
                    id: null,
                    error: "API response: " + res.statusCode + " " + res.statusText,
                }, res.headers, callbackParams);
            }
            return false;
        })
            .catch(function (err) {
            if (callback) {
                return callback({ id: null, error: err.errno }, {}, callbackParams);
            }
            return false;
        });
    };
    Api.prototype._getApiUrl = function (path) {
        var protocol = this.client.Websocket.useTLS ? 'https://' : 'http://';
        var port = this.client.options.httpPort ? ":" + this.client.options.httpPort : '';
        return protocol + this.client.host + port + apiPrefix + path;
    };
    return Api;
}());
exports.default = Api;
//# sourceMappingURL=api.js.map