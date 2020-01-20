import TextEncoding from 'text-encoding';
import request from 'request';

const apiPrefix = '/api/v4';

class Api {
    tlsVerify: boolean;

    additionalHeaders: object = {};

    logger: any;

    httpProxy: any;

    useTLS: boolean;

    options: any;

    host: string;

    private _token: string = null;

    constructor(
        tlsVerify: boolean,
        additionalHeaders: object,
        logger: any,
        httpProxy: any,
        useTLS: boolean,
        options: any,
        host: string,
    ) {
        this.tlsVerify = tlsVerify;
        this.additionalHeaders = additionalHeaders;
        this.logger = logger;
        this.httpProxy = httpProxy;
        this.useTLS = useTLS;
        this.options = options;
        this.host = host;
    }

    apiCall(
        method: string,
        path: string,
        params: any,
        callback: any,
        callbackParams: any = {},
        isForm = false,
    ) {
        let postData = '';
        if (params != null) { postData = JSON.stringify(params); }
        const options: any = {
            uri: this._getApiUrl(path),
            method,
            json: params,
            rejectUnauthorized: this.tlsVerify,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': new TextEncoding.TextEncoder('utf-8').encode(postData).length,
                'X-Requested-With': 'XMLHttpRequest',
            },
        };

        if (this.additionalHeaders) {
            options.headers = Object.assign(options.headers, { ...this.additionalHeaders });
        }

        if (this._token) { options.headers.Authorization = `BEARER ${this._token}`; }
        if (this.httpProxy) { options.proxy = this.httpProxy; }

        if (isForm) {
            options.headers['Content-Type'] = 'multipart/form-data';
            delete options.headers['Content-Length'];
            delete options.json;
            options.formData = params;
        }

        this.logger.debug(`${method} ${path}`);
        this.logger.info(`api url:${options.uri}`);

        return request(options, (error: any, res: any, value: any) => {
            if (error) {
                if (callback) {
                    return callback({ id: null, error: error.errno }, {}, callbackParams);
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

    _getApiUrl(path: string): string {
        const protocol = this.useTLS ? 'https://' : 'http://';
        const port = this.options.httpPort ? `:${this.options.httpPort}` : '';
        return protocol + this.host + port + apiPrefix + path;
    }

    // gets set on tokenLogin() in client
    set token(value: string) {
        this._token = value;
    }
}

export default Api;
