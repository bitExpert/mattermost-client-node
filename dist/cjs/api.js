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
var request_1 = __importDefault(require("request"));
var apiPrefix = '/api/v4';
var Api = (function () {
    function Api(client) {
        this._token = null;
        this.client = client;
    }
    Api.prototype.apiCall = function (method, path, params, callback, callbackParams, isForm) {
        if (callbackParams === void 0) { callbackParams = {}; }
        if (isForm === void 0) { isForm = false; }
        var postData = '';
        if (params != null) {
            postData = JSON.stringify(params);
        }
        var options = {
            uri: this._getApiUrl(path),
            method: method,
            json: params,
            rejectUnauthorized: this.client.tlsverify,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': new text_encoding_1.default.TextEncoder('utf-8').encode(postData).length,
                'X-Requested-With': 'XMLHttpRequest',
            },
        };
        if (this.client.additionalHeaders) {
            options.headers = Object.assign(options.headers, __assign({}, this.client.additionalHeaders));
        }
        if (this._token) {
            options.headers.Authorization = "BEARER " + this._token;
        }
        if (this.client.httpProxy) {
            options.proxy = this.client.httpProxy;
        }
        if (isForm) {
            options.headers['Content-Type'] = 'multipart/form-data';
            delete options.headers['Content-Length'];
            delete options.json;
            options.formData = params;
        }
        this.client.logger.debug(method + " " + path);
        this.client.logger.info("api url:" + options.uri);
        return request_1.default(options, function (error, res, value) {
            if (error) {
                if (callback) {
                    return callback({ id: null, error: error.errno }, {}, callbackParams);
                }
            }
            else if (callback) {
                if ((res.statusCode === 200) || (res.statusCode === 201)) {
                    var safeValue = typeof value === 'string'
                        ? JSON.parse(value)
                        : value;
                    return callback(safeValue, res.headers, callbackParams);
                }
                return callback({
                    id: null,
                    error: "API response: " + res.statusCode + " " + JSON.stringify(value),
                }, res.headers, callbackParams);
            }
            return false;
        });
    };
    Api.prototype._getApiUrl = function (path) {
        var protocol = this.client.useTLS ? 'https://' : 'http://';
        var port = this.client.options.httpPort ? ":" + this.client.options.httpPort : '';
        return protocol + this.client.host + port + apiPrefix + path;
    };
    Object.defineProperty(Api.prototype, "token", {
        set: function (value) {
            this._token = value;
        },
        enumerable: true,
        configurable: true
    });
    return Api;
}());
exports.default = Api;
//# sourceMappingURL=api.js.map