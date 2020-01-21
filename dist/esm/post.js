import querystring from 'querystring';
class Post {
    constructor(client) {
        this._messageMaxRunes = 4000;
        this.client = client;
        if (typeof this.client.options.messageMaxRunes !== 'undefined') {
            this._messageMaxRunes = this.client.options.messageMaxRunes;
        }
        this.initBindings();
    }
    initBindings() {
        this._onMessages = this._onMessages.bind(this);
    }
    loadMessagesFromChannel(channelId, options = {}) {
        let uri = `/channels/${channelId}/posts`;
        const allowedOptions = ['page', 'per_page', 'since', 'before', 'after'];
        const params = {};
        Object.entries(options).forEach((option) => {
            const [key, value] = option;
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
        uri += `?${querystring.stringify(params)}`;
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall('GET', uri, params, this._onMessages);
    }
    postMessage(msg, channelID) {
        const postData = {
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
        const chunks = this._chunkMessage(postData.message);
        postData.message = chunks.shift();
        return this.client.Api.apiCall('POST', '/posts', postData, (_data, _headers) => {
            this.client.logger.debug('Posted message.');
            if ((chunks != null ? chunks.length : undefined) > 0) {
                const message = chunks.join();
                const chunksLenght = chunks ? chunks.length : undefined;
                this.client.logger.debug(`Recursively posting remainder of message: (${chunksLenght})`);
                return this.postMessage(message, channelID);
            }
            return true;
        });
    }
    customMessage(postData, channelID) {
        let chunks;
        const postDataExt = { ...postData };
        if (postDataExt.message != null) {
            chunks = this._chunkMessage(postData.message);
            postDataExt.message = chunks.shift();
        }
        postDataExt.channel_id = channelID;
        return this.client.Api.apiCall('POST', '/posts', postData, (_data, _headers) => {
            this.client.logger.debug('Posted custom message.');
            if ((chunks != null ? chunks.length : undefined) > 0) {
                this.client.logger.debug(`Recursively posting remainder of customMessage: (${chunks.length})`);
                postDataExt.message = chunks.join();
                return this.customMessage(postData, channelID);
            }
            return true;
        });
    }
    editPost(postId, msg) {
        let postData = msg;
        if (typeof msg === 'string') {
            postData = {
                id: postId,
                message: msg,
            };
        }
        return this.client.Api.apiCall('PUT', `/posts/${postId}`, postData, (_data, _headers) => {
            this.client.logger.debug('Edited post');
        });
    }
    uploadFile(channelId, file, callback) {
        const formData = {
            channel_id: channelId,
            files: file,
        };
        return this.client.Api.apiCall('POST', '/files', formData, (data, _headers) => {
            this.client.logger.debug('Posted file');
            return callback(data);
        }, {}, true);
    }
    react(messageID, emoji) {
        const postData = {
            user_id: this.client.me.id,
            post_id: messageID,
            emoji_name: emoji,
            create_at: 0,
        };
        return this.client.Api.apiCall('POST', '/reactions', postData, (_data, _headers) => {
            this.client.logger.debug('Created reaction');
        });
    }
    unreact(messageID, emoji) {
        const uri = `/users/me/posts/${messageID}/reactions/${emoji}`;
        return this.client.Api.apiCall('DELETE', uri, [], (_data, _headers) => {
            this.client.logger.debug('Deleted reaction');
        });
    }
    _onMessages(data, _headers, _params) {
        if (data && !data.error) {
            this.client.logger.info(`Found ${Object.keys(data).length} messages.`);
            return this.client.emit('messagesLoaded', data);
        }
        this.client.logger.error(`Failed to get messages from server: ${data.error}`);
        return this.client.emit('error', { msg: 'failed to get messages' });
    }
    _chunkMessage(msg) {
        if (!msg) {
            return [''];
        }
        return msg.match(new RegExp(`(.|[\r\n]){1,${this._messageMaxRunes}}`, 'g'));
    }
}
export default Post;
//# sourceMappingURL=post.js.map