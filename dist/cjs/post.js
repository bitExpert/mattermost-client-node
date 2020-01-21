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
var querystring_1 = __importDefault(require("querystring"));
var Post = (function () {
    function Post(client) {
        this._messageMaxRunes = 4000;
        this.client = client;
        if (typeof this.client.options.messageMaxRunes !== 'undefined') {
            this._messageMaxRunes = this.client.options.messageMaxRunes;
        }
        this.initBindings();
    }
    Post.prototype.initBindings = function () {
        this._onMessages = this._onMessages.bind(this);
    };
    Post.prototype.loadMessagesFromChannel = function (channelId, options) {
        if (options === void 0) { options = {}; }
        var uri = "/channels/" + channelId + "/posts";
        var allowedOptions = ['page', 'per_page', 'since', 'before', 'after'];
        var params = {};
        Object.entries(options).forEach(function (option) {
            var key = option[0], value = option[1];
            if (allowedOptions.indexOf(key) >= 0) {
                params[key] = value;
            }
        });
        if (!params.page) {
            params.page = 0;
        }
        if (!params.per_page) {
            params.per_page = 30;
        }
        uri += "?" + querystring_1.default.stringify(params);
        this.client.logger.info("Loading " + uri);
        return this.client.Api.apiCall('GET', uri, params, this._onMessages);
    };
    Post.prototype.postMessage = function (msg, channelID) {
        var _this = this;
        var postData = {
            message: msg,
            file_ids: [],
            create_at: 0,
            user_id: this.client.me.id,
            channel_id: channelID,
        };
        if (typeof msg === 'string') {
            postData.message = msg;
        }
        else {
            postData.message = msg.message;
            if (msg.props) {
                postData.props = msg.props;
            }
            if (msg.file_ids) {
                postData.file_ids = msg.file_ids;
            }
        }
        var chunks = this._chunkMessage(postData.message);
        postData.message = chunks.shift();
        return this.client.Api.apiCall('POST', '/posts', postData, function (_data, _headers) {
            _this.client.logger.debug('Posted message.');
            if ((chunks != null ? chunks.length : undefined) > 0) {
                var message = chunks.join();
                var chunksLenght = chunks ? chunks.length : undefined;
                _this.client.logger.debug("Recursively posting remainder of message: (" + chunksLenght + ")");
                return _this.postMessage(message, channelID);
            }
            return true;
        });
    };
    Post.prototype.customMessage = function (postData, channelID) {
        var _this = this;
        var chunks;
        var postDataExt = __assign({}, postData);
        if (postDataExt.message != null) {
            chunks = this._chunkMessage(postData.message);
            postDataExt.message = chunks.shift();
        }
        postDataExt.channel_id = channelID;
        return this.client.Api.apiCall('POST', '/posts', postData, function (_data, _headers) {
            _this.client.logger.debug('Posted custom message.');
            if ((chunks != null ? chunks.length : undefined) > 0) {
                _this.client.logger.debug("Recursively posting remainder of customMessage: (" + chunks.length + ")");
                postDataExt.message = chunks.join();
                return _this.customMessage(postData, channelID);
            }
            return true;
        });
    };
    Post.prototype.editPost = function (postId, msg) {
        var _this = this;
        var postData = msg;
        if (typeof msg === 'string') {
            postData = {
                id: postId,
                message: msg,
            };
        }
        return this.client.Api.apiCall('PUT', "/posts/" + postId, postData, function (_data, _headers) {
            _this.client.logger.debug('Edited post');
        });
    };
    Post.prototype.uploadFile = function (channelId, file, callback) {
        var _this = this;
        var formData = {
            channel_id: channelId,
            files: file,
        };
        return this.client.Api.apiCall('POST', '/files', formData, function (data, _headers) {
            _this.client.logger.debug('Posted file');
            return callback(data);
        }, {}, true);
    };
    Post.prototype.react = function (messageID, emoji) {
        var _this = this;
        var postData = {
            user_id: this.client.me.id,
            post_id: messageID,
            emoji_name: emoji,
            create_at: 0,
        };
        return this.client.Api.apiCall('POST', '/reactions', postData, function (_data, _headers) {
            _this.client.logger.debug('Created reaction');
        });
    };
    Post.prototype.unreact = function (messageID, emoji) {
        var _this = this;
        var uri = "/users/me/posts/" + messageID + "/reactions/" + emoji;
        return this.client.Api.apiCall('DELETE', uri, [], function (_data, _headers) {
            _this.client.logger.debug('Deleted reaction');
        });
    };
    Post.prototype._onMessages = function (data, _headers, _params) {
        if (data && !data.error) {
            this.client.logger.info("Found " + Object.keys(data).length + " messages.");
            return this.client.emit('messagesLoaded', data);
        }
        this.client.logger.error("Failed to get messages from server: " + data.error);
        return this.client.emit('error', { msg: 'failed to get messages' });
    };
    Post.prototype._chunkMessage = function (msg) {
        if (!msg) {
            return [''];
        }
        return msg.match(new RegExp("(.|[\r\n]){1," + this._messageMaxRunes + "}", 'g'));
    };
    return Post;
}());
exports.default = Post;
//# sourceMappingURL=post.js.map