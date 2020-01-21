"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Team = (function () {
    function Team(client, usersRoute) {
        this._teams = {};
        this._teamID = null;
        this.client = client;
        this.usersRoute = usersRoute;
        this.initBindings();
    }
    Team.prototype.initBindings = function () {
        this._onTeams = this._onTeams.bind(this);
        this._onTeamsByName = this._onTeamsByName.bind(this);
        this._onCreateTeam = this._onCreateTeam.bind(this);
        this._onAddUserToTeam = this._onAddUserToTeam.bind(this);
        this._onCheckIfTeamExists = this._onCheckIfTeamExists.bind(this);
    };
    Team.prototype.getTeams = function () {
        var uri = this.usersRoute + "/me/teams";
        this.client.logger.info("Loading " + uri);
        return this.client.Api.apiCall('GET', uri, null, this._onTeams);
    };
    Team.prototype.getTeamByName = function (teamName) {
        var uri = "/teams/name/" + teamName;
        this.client.logger.info("Loading " + uri);
        return this.client.Api.apiCall('GET', uri, null, this._onTeamsByName);
    };
    Team.prototype.checkIfTeamExists = function (teamName) {
        var uri = "/teams/name/" + teamName + "/exists";
        return this.client.Api.apiCall('GET', uri, null, this._onCheckIfTeamExists);
    };
    Team.prototype.createTeam = function (name, display_name, type) {
        if (type === void 0) { type = 'I'; }
        var uri = '/teams';
        return this.client.Api.apiCall('POST', uri, { name: name, display_name: display_name, type: type }, this._onCreateTeam);
    };
    Team.prototype.addUserToTeam = function (user_id, team_id) {
        var postData = {
            team_id: team_id,
            user_id: user_id,
        };
        var uri = "/teams/" + team_id + "/members";
        return this.client.Api.apiCall('POST', uri, postData, this._onAddUserToTeam);
    };
    Team.prototype._onTeams = function (data, _headers, _params) {
        var _this = this;
        if (data && !data.error) {
            this._teams = data;
            this.client.emit('teamsLoaded', data);
            if (!data.length) {
                return this._teams;
            }
            this.client.logger.info("Found " + Object.keys(this._teams).length + " teams.");
            this._teams
                .find(function (team) {
                var isTeamFound = team.name.toLowerCase() === _this.client.team.toLowerCase();
                _this.client.logger.debug("Testing " + team.name + " == " + _this.client.team);
                if (isTeamFound) {
                    _this._teamID = team.id;
                    _this.client.logger.info("Found team! " + team.id);
                }
                return isTeamFound;
            });
            this.client.User.loadUsers();
            return this.client.Channel.loadChannels();
        }
        this.client.logger.error('Failed to load Teams...');
        return this.client.reconnect();
    };
    Team.prototype._onTeamsByName = function (data, _headers, _params) {
        if (data && !data.error) {
            this.client.logger.info("Found " + Object.keys(data).length + " channels.");
            return this.client.emit('teamsByNameLoaded', data);
        }
        this.client.logger.error("Failed to get team by name from server: " + data.error);
        return this.client.emit('error', { msg: 'failed to get team by name' });
    };
    Team.prototype._onCreateTeam = function (data) {
        if (!data.error) {
            this.client.logger.info('Creating team...');
            return this.client.emit('teamCreated', data);
        }
        this.client.logger.error('Team creation failed', JSON.stringify(data));
        return this.client.emit('error', data);
    };
    Team.prototype._onAddUserToTeam = function (data) {
        if (!data.error) {
            this.client.logger.info('Adding user to team...');
            return this.client.emit('userAdded', data);
        }
        this.client.logger.error('An error occured while adding user to team: ', JSON.stringify(data));
        return this.client.emit('error', data);
    };
    Team.prototype._onCheckIfTeamExists = function (data) {
        if (!data.error) {
            this.client.logger.info('Checking if team exists...');
            return this.client.emit('teamChecked', data);
        }
        this.client.logger.error('An error occured while checking if team exists: ', JSON.stringify(data));
        return this.client.emit('error', data);
    };
    Object.defineProperty(Team.prototype, "teamID", {
        get: function () {
            return this._teamID;
        },
        set: function (value) {
            this._teamID = value;
        },
        enumerable: true,
        configurable: true
    });
    Team.prototype.teamRoute = function () {
        return this.usersRoute + "/me/teams/" + this.teamID;
    };
    return Team;
}());
exports.default = Team;
//# sourceMappingURL=team.js.map