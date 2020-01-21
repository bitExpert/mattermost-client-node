class Team {
    constructor(client, usersRoute) {
        this._teams = {};
        this._teamID = null;
        this.client = client;
        this.usersRoute = usersRoute;
        this.initBindings();
    }
    initBindings() {
        this._onTeams = this._onTeams.bind(this);
        this._onTeamsByName = this._onTeamsByName.bind(this);
        this._onCreateTeam = this._onCreateTeam.bind(this);
        this._onAddUserToTeam = this._onAddUserToTeam.bind(this);
        this._onCheckIfTeamExists = this._onCheckIfTeamExists.bind(this);
    }
    getTeams() {
        const uri = `${this.usersRoute}/me/teams`;
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall('GET', uri, null, this._onTeams);
    }
    getTeamByName(teamName) {
        const uri = `/teams/name/${teamName}`;
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall('GET', uri, null, this._onTeamsByName);
    }
    checkIfTeamExists(teamName) {
        const uri = `/teams/name/${teamName}/exists`;
        return this.client.Api.apiCall('GET', uri, null, this._onCheckIfTeamExists);
    }
    createTeam(name, display_name, type = 'I') {
        const uri = '/teams';
        return this.client.Api.apiCall('POST', uri, { name, display_name, type }, this._onCreateTeam);
    }
    addUserToTeam(user_id, team_id) {
        const postData = {
            team_id,
            user_id,
        };
        const uri = `/teams/${team_id}/members`;
        return this.client.Api.apiCall('POST', uri, postData, this._onAddUserToTeam);
    }
    _onTeams(data, _headers, _params) {
        if (data && !data.error) {
            this._teams = data;
            this.client.emit('teamsLoaded', data);
            if (!data.length) {
                return this._teams;
            }
            this.client.logger.info(`Found ${Object.keys(this._teams).length} teams.`);
            this._teams
                .find((team) => {
                const isTeamFound = team.name.toLowerCase() === this.client.team.toLowerCase();
                this.client.logger.debug(`Testing ${team.name} == ${this.client.team}`);
                if (isTeamFound) {
                    this._teamID = team.id;
                    this.client.logger.info(`Found team! ${team.id}`);
                }
                return isTeamFound;
            });
            this.client.User.loadUsers();
            return this.client.Channel.loadChannels();
        }
        this.client.logger.error('Failed to load Teams...');
        return this.client.reconnect();
    }
    _onTeamsByName(data, _headers, _params) {
        if (data && !data.error) {
            this.client.logger.info(`Found ${Object.keys(data).length} channels.`);
            return this.client.emit('teamsByNameLoaded', data);
        }
        this.client.logger.error(`Failed to get team by name from server: ${data.error}`);
        return this.client.emit('error', { msg: 'failed to get team by name' });
    }
    _onCreateTeam(data) {
        if (!data.error) {
            this.client.logger.info('Creating team...');
            return this.client.emit('teamCreated', data);
        }
        this.client.logger.error('Team creation failed', JSON.stringify(data));
        return this.client.emit('error', data);
    }
    _onAddUserToTeam(data) {
        if (!data.error) {
            this.client.logger.info('Adding user to team...');
            return this.client.emit('userAdded', data);
        }
        this.client.logger.error('An error occured while adding user to team: ', JSON.stringify(data));
        return this.client.emit('error', data);
    }
    _onCheckIfTeamExists(data) {
        if (!data.error) {
            this.client.logger.info('Checking if team exists...');
            return this.client.emit('teamChecked', data);
        }
        this.client.logger.error('An error occured while checking if team exists: ', JSON.stringify(data));
        return this.client.emit('error', data);
    }
    get teamID() {
        return this._teamID;
    }
    set teamID(value) {
        this._teamID = value;
    }
    teamRoute() {
        return `${this.usersRoute}/me/teams/${this.teamID}`;
    }
}
export default Team;
//# sourceMappingURL=team.js.map