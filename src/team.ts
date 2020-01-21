class Team {
    client: any;

    usersRoute: string;

    private _teams: any = {};

    private _teamID: string = null;

    constructor(
        client: any,
        usersRoute: string,
    ) {
        this.client = client;
        this.usersRoute = usersRoute;

        this.initBindings();
    }

    initBindings(): any {
        this._onTeams = this._onTeams.bind(this);
        this._onTeamsByName = this._onTeamsByName.bind(this);
        this._onCreateTeam = this._onCreateTeam.bind(this);
        this._onAddUserToTeam = this._onAddUserToTeam.bind(this);
        this._onCheckIfTeamExists = this._onCheckIfTeamExists.bind(this);
    }

    /**
     * get team(s)
     */

    getTeams(): any {
        const uri = `${this.usersRoute}/me/teams`;
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall(
            'GET',
            uri,
            null,
            this._onTeams,
        );
    }

    getTeamByName(teamName: string): any {
        const uri = `/teams/name/${teamName}`;
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall(
            'GET',
            uri,
            null,
            this._onTeamsByName,
        );
    }

    // @Todo tests
    checkIfTeamExists(teamName: string): any {
        const uri = `/teams/name/${teamName}/exists`;
        return this.client.Api.apiCall(
            'GET',
            uri,
            null,
            this._onCheckIfTeamExists,
        );
    }


    /**
     * create team(s) / update team(s)
     */

    // @Todo tests
    // eslint-disable-next-line @typescript-eslint/camelcase
    createTeam(name: string, display_name: string, type = 'I'): any {
        const uri = '/teams';
        // eslint-disable-next-line @typescript-eslint/camelcase
        return this.client.Api.apiCall(
            'POST',
            uri,
            // eslint-disable-next-line @typescript-eslint/camelcase
            { name, display_name, type },
            this._onCreateTeam,
        );
    }

    // @Todo tests
    // eslint-disable-next-line @typescript-eslint/camelcase
    addUserToTeam(user_id: string, team_id: string): any {
        const postData = {
            // eslint-disable-next-line @typescript-eslint/camelcase
            team_id,
            // eslint-disable-next-line @typescript-eslint/camelcase
            user_id,
        };
        // eslint-disable-next-line @typescript-eslint/camelcase
        const uri = `/teams/${team_id}/members`;
        return this.client.Api.apiCall(
            'POST',
            uri,
            postData,
            this._onAddUserToTeam,
        );
    }


    /**
     * callbacks
     */

    /**
     * @event
     */
    private _onTeams(data: any, _headers: any, _params: any): any {
        if (data && !data.error) {
            this._teams = data;
            this.client.emit('teamsLoaded', data);
            // do not go further if user is not added to a team
            if (!data.length) {
                return this._teams;
            }
            this.client.logger.info(`Found ${Object.keys(this._teams).length} teams.`);
            this._teams
                .find((team: any) => {
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

    /**
     * @event
     */
    private _onTeamsByName(data: any, _headers: any, _params: any): any {
        if (data && !data.error) {
            this.client.logger.info(`Found ${Object.keys(data).length} channels.`);
            return this.client.emit('teamsByNameLoaded', data);
        }
        this.client.logger.error(`Failed to get team by name from server: ${data.error}`);
        return this.client.emit('error', { msg: 'failed to get team by name' });
    }

    /**
     * @event
     */
    private _onCreateTeam(data: any): any {
        if (!data.error) {
            this.client.logger.info('Creating team...');
            return this.client.emit('teamCreated', data);
        }
        this.client.logger.error('Team creation failed', JSON.stringify(data));
        return this.client.emit('error', data);
    }

    /**
     * @event
     */
    private _onAddUserToTeam(data: any): any {
        if (!data.error) {
            this.client.logger.info('Adding user to team...');
            return this.client.emit('userAdded', data);
        }
        this.client.logger.error('An error occured while adding user to team: ', JSON.stringify(data));
        return this.client.emit('error', data);
    }

    /**
     * @event
     */
    private _onCheckIfTeamExists(data: any): any {
        if (!data.error) {
            this.client.logger.info('Checking if team exists...');
            return this.client.emit('teamChecked', data);
        }
        this.client.logger.error('An error occured while checking if team exists: ', JSON.stringify(data));
        return this.client.emit('error', data);
    }


    /**
     * getters & setters
     */

    get teamID(): string {
        return this._teamID;
    }

    set teamID(value: string) {
        this._teamID = value;
    }


    /**
     * helpers
     */

    teamRoute(): string {
        return `${this.usersRoute}/me/teams/${this.teamID}`;
    }
}

export default Team;
