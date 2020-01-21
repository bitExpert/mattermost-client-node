import TextEncoding from 'text-encoding';
import fetch from 'node-fetch';

const apiPrefix = '/api/v4';

class Api {
    client: any;

    private _additionalHeaders: object = {};

    constructor(
        client: any,
    ) {
        this.client = client;

        if (typeof this.client.options.additionalHeaders === 'object') {
            this._additionalHeaders = this.client.options.additionalHeaders;
        }
    }

    /**
     * @internal
     */
    apiCall(
        method: string,
        path: string,
        body: any,
        callback: any,
        callbackParams: any = {},
        isForm = false,
    ): any {
        let postData = '';
        let res: any;

        if (body != null) {
            postData = JSON.stringify(body);
        }

        const payload: any = {
            path: this._getApiUrl(path),
            options: {
                method,
                body,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': new TextEncoding.TextEncoder('utf-8').encode(postData).length,
                    'X-Requested-With': 'XMLHttpRequest',
                },
            },
        };

        if (this._additionalHeaders) {
            payload.options.headers = Object.assign(
                payload.options.headers,
                { ...this._additionalHeaders },
            );
        }

        if (this.client.Authentication.token) {
            payload.options.headers.Authorization = `BEARER ${this.client.Authentication.token}`;
        }
        if (this.client.Websocket.httpProxy) {
            payload.options.proxy = this.client.Websocket.httpProxy;
        }

        if (isForm) {
            payload.options.headers['Content-Type'] = 'multipart/form-data';
            delete payload.options.headers['Content-Length'];
        }

        this.client.logger.debug(`${method} ${path}`);
        this.client.logger.info(`api url:${payload.path}`);

        return fetch(payload.path, payload.options)
            .then((rawResponse: any) => {
                res = rawResponse;
                return rawResponse.json();
            })
            .then((json: any) => {
                if (callback) {
                    if ((res.status === 200) || (res.status === 201)) {
                        return callback(json, res.headers, callbackParams);
                    }
                    return callback({
                        id: null,
                        error: `API response: ${res.statusCode} ${res.statusText}`,
                    }, res.headers, callbackParams);
                }
                return false;
            })
            .catch((err) => {
                if (callback) {
                    return callback({ id: null, error: err.errno }, {}, callbackParams);
                }
                return false;
            });
    }

    /**
     * @internal
     */
    _getApiUrl(path: string): string {
        const protocol = this.client.Websocket.useTLS ? 'https://' : 'http://';
        const port = this.client.options.httpPort ? `:${this.client.options.httpPort}` : '';
        return protocol + this.client.host + port + apiPrefix + path;
    }
}

export default Api;
