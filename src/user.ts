class User {
    client: any;

    usersRoute: string;

    private _users: any = {};

    private _userPreferences: any;

    constructor(
        client: any,
        usersRoute: string,
    ) {
        this.client = client;
        this.usersRoute = usersRoute;

        this.initBindings();
    }

    initBindings(): any {
        this._onMe = this._onMe.bind(this);
        this._onLoadUsers = this._onLoadUsers.bind(this);
        this._onLoadUser = this._onLoadUser.bind(this);
        this._onCreateUser = this._onCreateUser.bind(this);
        this._onPreferences = this._onPreferences.bind(this);
        this._onUsersOfChannel = this._onUsersOfChannel.bind(this);
    }

    /**
     * get user(s)
     */

    getMe(): any {
        const uri = `${this.usersRoute}/me`;
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall('GET', uri, null, this._onMe);
    }

    loadUsers(page = 0, byTeam = true): any {
        let uri = `/users?page=${page}&per_page=200`;
        // get only users of team (surveybot NOT included)
        if (byTeam) {
            uri += `&in_team=${this.client.Team.teamID}`;
        }
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall('GET', uri, null, this._onLoadUsers, { page });
    }

    loadUser(userId: string): any {
        const uri = `/users/${userId}`;
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall('GET', uri, null, this._onLoadUser, {});
    }

    // @Todo tests
    loadUsersFromChannel(channelId: string): any {
        const uri = `/channels/${channelId}/members`;
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall('GET', uri, null, this._onUsersOfChannel);
    }

    getPreferences(): any {
        const uri = `${this.usersRoute}/me/preferences`;
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall('GET', uri, null, this._onPreferences);
    }


    /**
     * create user(s)
     */
    // difficult to test as there is no delete but only a deactivate function for users
    createUser(user: IUser): any {
        const uri = `${this.usersRoute}?iid=`;
        return this.client.Api.apiCall('POST', uri, user, this._onCreateUser);
    }


    /**
     * return user(s)
     */

    getUserByID(id: string): Record<string, any> {
        return this._users[id];
    }

    getUserByEmail(email: string): Record<string, any> {
        return Object.values(this._users)
            .find((user: any) => user.email === email);
    }

    getAllUsers(): any {
        return this._users;
    }


    /**
     * callbacks
     */

    /**
     * @event
     */
    private _onMe(data: any, _headers: any, _params: any): any {
        if (data && !data.error) {
            this.client.me = data;
            this.client.emit('meLoaded', data);
            return this.client.logger.info('Loaded Me...');
        }
        this.client.logger.error(`Failed to load Me...${data.error}`);
        return this.client.reconnect();
    }

    /**
     * @event
     */
    private _onLoadUsers(data: IUser[] | any, _headers: any, params: any): any {
        if (data && !data.error) {
            data.forEach((user: IUser) => {
                this._users[user.id] = user;
            });
            this.client.logger.info(`Found ${Object.keys(data).length} profiles.`);
            this.client.emit('profilesLoaded', data);
            if ((Object.keys(data).length > 200) && (params.page != null)) {
                return this.loadUsers(params.page + 1); // Trigger next page loading
            }
            return this._users;
        }
        this.client.logger.error('Failed to load profiles from server.');
        return this.client.emit('error', { msg: 'failed to load profiles' });
    }

    /**
     * @event
     */
    private _onLoadUser(data: any, _headers: any, _params: any): any {
        if (data && !data.error) {
            this._users[data.id] = data;
            return this.client.emit('profilesLoaded', [data]);
        }
        return this.client.emit('error', { msg: 'failed to load profile' });
    }

    /**
     * @event
     */
    private _onCreateUser(data: any): any {
        if (data.id) {
            this.client.logger.info('Creating user...');
            return this.client.emit('created', data);
        }
        this.client.logger.error('User creation failed', JSON.stringify(data));
        return this.client.emit('error', data);
    }

    /**
     * @event
     */
    private _onUsersOfChannel(data: any, _headers: any, _params: any): any {
        if (data && !data.error) {
            Object.entries(data).forEach((channel: any) => {
                this.client.Channel.channels[channel.id] = channel;
            });
            this.client.logger.info(`Found ${Object.keys(data).length} users.`);
            return this.client.emit('usersOfChannelLoaded', data);
        }
        this.client.logger.error(`Failed to get channel users from server: ${data.error}`);
        return this.client.emit('error', { msg: 'failed to get channel users' });
    }

    /**
     * @event
     */
    private _onPreferences(data: any, _headers: any, _params: any): any {
        if (data && !data.error) {
            this._userPreferences = data;
            this.client.emit('preferencesLoaded', data);
            return this.client.logger.info('Loaded Preferences...');
        }
        this.client.logger.error(`Failed to load Preferences...${data.error}`);
        return this.client.reconnect();
    }


    /**
     * getter & setter
     */

    get users(): any {
        return this._users;
    }

    set users(value: any) {
        this._users = value;
    }
}

export default User;
