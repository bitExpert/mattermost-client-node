import TextEncoding from 'text-encoding';
import request from 'request';

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
        params: any,
        callback: any,
        callbackParams: any = {},
        isForm = false,
    ): any {
        let postData = '';
        if (params != null) { postData = JSON.stringify(params); }
        const options: any = {
            uri: this._getApiUrl(path),
            method,
            json: params,
            rejectUnauthorized: this.client.Websocket.tlsverify,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': new TextEncoding.TextEncoder('utf-8').encode(postData).length,
                'X-Requested-With': 'XMLHttpRequest',
            },
        };

        if (this._additionalHeaders) {
            options.headers = Object.assign(
                options.headers,
                { ...this._additionalHeaders },
            );
        }

        if (this.client.Authentication.token) {
            options.headers.Authorization = `BEARER ${this.client.Authentication.token}`;
        }
        if (this.client.Websocket.httpProxy) {
            options.proxy = this.client.Websocket.httpProxy;
        }

        if (isForm) {
            options.headers['Content-Type'] = 'multipart/form-data';
            delete options.headers['Content-Length'];
            delete options.json;
            options.formData = params;
        }

        this.client.logger.debug(`${method} ${path}`);
        this.client.logger.info(`api url:${options.uri}`);

        return request(options, (error: any, res: any, value: any) => {
            if (error) {
                if (callback) {
                    return callback({ id: null, error: error.code }, {}, callbackParams);
                }
            } else if (callback) {
                if ((res.statusCode === 200) || (res.statusCode === 201)) {
                    const safeValue = typeof value === 'string'
                        ? JSON.parse(value)
                        : value;

                    return callback(safeValue, res.headers, callbackParams);
                }
                return callback({
                    id: null,
                    error: `API response: ${res.statusCode} ${JSON.stringify(value)}`,
                }, res.headers, callbackParams);
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
