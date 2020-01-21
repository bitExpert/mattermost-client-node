class Authentication {
    client: any;

    usersRoute: string;

    private _authenticated = false;

    private _hasAccessToken = false;

    private _token: string;

    private _mfaToken: string;

    private _authEmail: string;

    private _authPassword: string;

    constructor(
        client: any,
        usersRoute: string,
    ) {
        this.client = client;
        this.usersRoute = usersRoute;

        this.initBindings();
    }

    initBindings(): any {
        this._onLogin = this._onLogin.bind(this);
        this._onRevoke = this._onRevoke.bind(this);
    }

    /**
     * authenticate
     */

    login(email: string, password: string, mfaToken: string): any {
        this._hasAccessToken = false;
        this._authEmail = email;
        this._authPassword = password;
        this._mfaToken = mfaToken;
        this.client.logger.info('Logging in...');
        return this.client.Api.apiCall(
            'POST',
            `${this.usersRoute}/login`,
            {
                // eslint-disable-next-line @typescript-eslint/camelcase
                login_id: this._authEmail,
                password: this._authPassword,
                token: this._mfaToken,
            },
            this._onLogin,
        );
    }

    // @Todo tests
    tokenLogin(token: string): any {
        this._token = token;
        this._hasAccessToken = true;
        this.client.logger.info('Logging in with personal access token...');
        const uri = `${this.usersRoute}/me`;
        return this.client.Api.apiCall('GET', uri, null, this._onLogin);
    }

    // @Todo tests
    // revoke a user session
    revoke(userID: string): any {
        return this.client.Api.apiCall('POST', `${this.usersRoute}/${userID}/sessions/revoke`, {}, this._onRevoke);
    }

    /**
     * callbacks
     */

    _onLogin(data: any, headers: any): any {
        if (data) {
            if (!data.id) {
                this.client.logger.error('Login call failed', JSON.stringify(data));
                this.client.emit('error', data);
                this._authenticated = false;
                this.client.Websocket.reconnecting = false;
                return this.client.Websocket.reconnect();
            }
            this._authenticated = true;
            // Continue happy flow here
            if (!this._hasAccessToken) {
                this._token = headers.token;
            }
            this.client.Websocket.socketUrl = this.client.Websocket.getSocketUrl();
            this.client.logger.info(`Websocket URL: ${this.client.Websocket.socketUrl}`);
            this.client.me = data;
            this.client.emit('loggedIn', this.client.me);
            this.client.User.getMe();
            this.client.User.getPreferences();
            return this.client.Team.getTeams();
        }
        this.client.emit('error', data);
        this._authenticated = false;
        return this.client.Websocket.reconnect();
    }

    _onRevoke(data: any): any {
        return this.client.emit('sessionRevoked', data);
    }


    /**
     * getters & setters
     */

    set authenticated(value: boolean) {
        this._authenticated = value;
    }

    get token(): string {
        return this._token;
    }

    set token(value: string) {
        this._token = value;
    }

    get mfaToken(): string {
        return this._mfaToken;
    }

    get authEmail(): string {
        return this._authEmail;
    }

    get authPassword(): string {
        return this._authPassword;
    }
}

export default Authentication;
