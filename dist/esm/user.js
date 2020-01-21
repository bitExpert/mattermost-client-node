class User {
    constructor(client, usersRoute) {
        this._users = {};
        this.client = client;
        this.usersRoute = usersRoute;
        this.initBindings();
    }
    initBindings() {
        this._onMe = this._onMe.bind(this);
        this._onLoadUsers = this._onLoadUsers.bind(this);
        this._onLoadUser = this._onLoadUser.bind(this);
        this._onCreateUser = this._onCreateUser.bind(this);
        this._onPreferences = this._onPreferences.bind(this);
        this._onUsersOfChannel = this._onUsersOfChannel.bind(this);
    }
    getMe() {
        const uri = `${this.usersRoute}/me`;
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall('GET', uri, null, this._onMe);
    }
    loadUsers(page = 0, byTeam = true) {
        let uri = `/users?page=${page}&per_page=200`;
        if (byTeam) {
            uri += `&in_team=${this.client.Team.teamID}`;
        }
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall('GET', uri, null, this._onLoadUsers, { page });
    }
    loadUser(userId) {
        const uri = `/users/${userId}`;
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall('GET', uri, null, this._onLoadUser, {});
    }
    loadUsersFromChannel(channelId) {
        const uri = `/channels/${channelId}/members`;
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall('GET', uri, null, this._onUsersOfChannel);
    }
    getPreferences() {
        const uri = `${this.usersRoute}/me/preferences`;
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall('GET', uri, null, this._onPreferences);
    }
    createUser(user) {
        const uri = `${this.usersRoute}?iid=`;
        return this.client.Api.apiCall('POST', uri, user, this._onCreateUser);
    }
    getUserByID(id) {
        return this._users[id];
    }
    getUserByEmail(email) {
        return Object.values(this._users)
            .find((user) => user.email === email);
    }
    getAllUsers() {
        return this._users;
    }
    _onMe(data, _headers, _params) {
        if (data && !data.error) {
            this.client.me = data;
            this.client.emit('meLoaded', data);
            return this.client.logger.info('Loaded Me...');
        }
        this.client.logger.error(`Failed to load Me...${data.error}`);
        return this.client.reconnect();
    }
    _onLoadUsers(data, _headers, params) {
        if (data && !data.error) {
            data.forEach((user) => {
                this._users[user.id] = user;
            });
            this.client.logger.info(`Found ${Object.keys(data).length} profiles.`);
            this.client.emit('profilesLoaded', data);
            if ((Object.keys(data).length > 200) && (params.page != null)) {
                return this.loadUsers(params.page + 1);
            }
            return this._users;
        }
        this.client.logger.error('Failed to load profiles from server.');
        return this.client.emit('error', { msg: 'failed to load profiles' });
    }
    _onLoadUser(data, _headers, _params) {
        if (data && !data.error) {
            this._users[data.id] = data;
            return this.client.emit('profilesLoaded', [data]);
        }
        return this.client.emit('error', { msg: 'failed to load profile' });
    }
    _onCreateUser(data) {
        if (data.id) {
            this.client.logger.info('Creating user...');
            return this.client.emit('created', data);
        }
        this.client.logger.error('User creation failed', JSON.stringify(data));
        return this.client.emit('error', data);
    }
    _onUsersOfChannel(data, _headers, _params) {
        if (data && !data.error) {
            Object.entries(data).forEach((channel) => {
                this.client.Channel.channels[channel.id] = channel;
            });
            this.client.logger.info(`Found ${Object.keys(data).length} users.`);
            return this.client.emit('usersOfChannelLoaded', data);
        }
        this.client.logger.error(`Failed to get channel users from server: ${data.error}`);
        return this.client.emit('error', { msg: 'failed to get channel users' });
    }
    _onPreferences(data, _headers, _params) {
        if (data && !data.error) {
            this._userPreferences = data;
            this.client.emit('preferencesLoaded', data);
            return this.client.logger.info('Loaded Preferences...');
        }
        this.client.logger.error(`Failed to load Preferences...${data.error}`);
        return this.client.reconnect();
    }
    get users() {
        return this._users;
    }
    set users(value) {
        this._users = value;
    }
}
export default User;
//# sourceMappingURL=user.js.map