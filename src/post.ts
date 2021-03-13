import querystring from 'querystring';

class Post {
    client: any;

    private readonly _messageMaxRunes = 4000;

    constructor(
        client: any,
    ) {
        this.client = client;

        if (typeof this.client.options.messageMaxRunes !== 'undefined') {
            this._messageMaxRunes = this.client.options.messageMaxRunes;
        }

        this.initBindings();
    }

    initBindings(): any {
        this._onMessages = this._onMessages.bind(this);
    }


    /**
     * get post(s)
     * @Todo rename message to post
     * @Todo tests
     */

    loadMessagesFromChannel(channelId: string, options: any = {}): any {
        let uri = `/channels/${channelId}/posts`;
        const allowedOptions = ['page', 'per_page', 'since', 'before', 'after'];
        const params: any = {};
        Object.entries(options).forEach((option: any) => {
            const [key, value] = option;
            if (allowedOptions.indexOf(key) >= 0) {
                params[key] = value;
            }
        });
        // set standard params for page / per_page if not set
        if (!params.page) {
            params.page = 0;
        }
        if (!params.per_page) {
            // eslint-disable-next-line @typescript-eslint/camelcase
            params.per_page = 30;
        }
        uri += `?${querystring.stringify(params)}`;
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall('GET', uri, params, this._onMessages);
    }


    /**
     * create post(s) / edit post(s)
     * @Todo rename message to post
     * @Todo tests
     */

    postMessage(msg: any, channelID: string): any {
        const postData: any = {
            message: msg,
            // eslint-disable-next-line @typescript-eslint/camelcase
            file_ids: [],
            // eslint-disable-next-line @typescript-eslint/camelcase
            create_at: 0,
            // eslint-disable-next-line @typescript-eslint/camelcase
            user_id: this.client.me.id,
            // eslint-disable-next-line @typescript-eslint/camelcase
            channel_id: channelID,
        };

        if (typeof msg === 'string') {
            postData.message = msg;
        } else {
            postData.message = msg.message;
            if (msg.props) {
                postData.props = msg.props;
            }
            // eslint-disable-next-line @typescript-eslint/camelcase
            if (msg.file_ids) {
                // eslint-disable-next-line @typescript-eslint/camelcase
                postData.file_ids = msg.file_ids;
            }
        }

        // break apart long messages
        const chunks = this._chunkMessage(postData.message);
        postData.message = chunks.shift();

        return this.client.Api.apiCall(
            'POST',
            '/posts',
            postData,
            (_data: any, _headers: any) => {
                this.client.logger.debug('Posted message.');

                if ((chunks != null ? chunks.length : undefined) > 0) {
                    const message = chunks.join();
                    const chunksLenght = chunks ? chunks.length : undefined;
                    this.client.logger.debug(`Recursively posting remainder of message: (${chunksLenght})`);
                    return this.postMessage(message, channelID);
                }

                return true;
            },
        );
    }

    /**
     * execute command(s)
     * @Todo tests
     */
    postCommand(cmd: any, channelID: string): any {
        const postData: any = {
            command: cmd,
            // eslint-disable-next-line @typescript-eslint/camelcase
            channel_id: channelID,
        };
        const chunks = this._chunkMessage(postData.command);
        postData.command = chunks.shift();

        return this.client.Api.apiCall(
            'POST',
            '/commands/execute',
            postData,
            (_data: any, _headers: any) => {
                this.client.logger.debug('Executed command.');

                if ((chunks != null ? chunks.length : undefined) > 0) {
                    const command = chunks.join();
                    const chunksLenght = chunks ? chunks.length : undefined;
                    this.client.logger.debug(`Recursively posting remainder of command: (${chunksLenght})`);
                    return this.postCommand(command, channelID);
                }

                return true;
            },
        );
    }

    // @Todo tests
    customMessage(postData: any, channelID: string): any {
        let chunks: any;
        const postDataExt = { ...postData };
        if (postDataExt.message != null) {
            chunks = this._chunkMessage(postData.message);
            postDataExt.message = chunks.shift();
        }
        // eslint-disable-next-line @typescript-eslint/camelcase
        postDataExt.channel_id = channelID;
        return this.client.Api.apiCall('POST', '/posts', postData, (_data: any, _headers: any) => {
            this.client.logger.debug('Posted custom message.');
            if ((chunks != null ? chunks.length : undefined) > 0) {
                this.client.logger.debug(`Recursively posting remainder of customMessage: (${chunks.length})`);
                postDataExt.message = chunks.join();
                return this.customMessage(postData, channelID);
            }
            return true;
        });
    }

    // @Todo tests
    editPost(postId: string, msg: any): any {
        let postData: any = msg;
        if (typeof msg === 'string') {
            postData = {
                id: postId,
                message: msg,
            };
        }
        return this.client.Api.apiCall(
            'PUT',
            `/posts/${postId}`,
            postData,
            (_data: any, _headers: any) => {
                this.client.logger.debug('Edited post');
            },
        );
    }

    // @Todo tests
    uploadFile(channelId: string, file: any, callback: any): any {
        const formData = {
            // eslint-disable-next-line @typescript-eslint/camelcase
            channel_id: channelId,
            files: file,
        };

        return this.client.Api.apiCall(
            'POST',
            '/files',
            formData,
            (data: any, _headers: any) => {
                this.client.logger.debug('Posted file');
                return callback(data);
            },
            {},
            true,
        );
    }

    // @Todo tests
    react(messageID: string, emoji: string): any {
        const postData = {
            // eslint-disable-next-line @typescript-eslint/camelcase
            user_id: this.client.me.id,
            // eslint-disable-next-line @typescript-eslint/camelcase
            post_id: messageID,
            // eslint-disable-next-line @typescript-eslint/camelcase
            emoji_name: emoji,
            // eslint-disable-next-line @typescript-eslint/camelcase
            create_at: 0,
        };
        return this.client.Api.apiCall('POST', '/reactions', postData, (_data: any, _headers: any) => {
            this.client.logger.debug('Created reaction');
        });
    }

    // @Todo tests
    unreact(messageID: string, emoji: string): any {
        const uri = `/users/me/posts/${messageID}/reactions/${emoji}`;
        return this.client.Api.apiCall('DELETE', uri, [], (_data: any, _headers: any) => {
            this.client.logger.debug('Deleted reaction');
        });
    }


    /**
     * callbacks
     */

    /**
     * @event
     */
    private _onMessages(data: any, _headers: any, _params: any): any {
        if (data && !data.error) {
            this.client.logger.info(`Found ${Object.keys(data).length} messages.`);
            return this.client.emit('messagesLoaded', data);
        }
        this.client.logger.error(`Failed to get messages from server: ${data.error}`);
        return this.client.emit('error', { msg: 'failed to get messages' });
    }


    /**
     * helpers
     */

    _chunkMessage(msg: any): Array<string> {
        if (!msg) {
            return [''];
        }
        return msg.match(new RegExp(`(.|[\r\n]){1,${this._messageMaxRunes}}`, 'g'));
    }
}

export default Post;
