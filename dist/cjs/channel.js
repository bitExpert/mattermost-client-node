"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Channel = (function () {
    function Channel(client, usersRoute) {
        this._channels = {};
        this.client = client;
        this.usersRoute = usersRoute;
        this.initBindings();
    }
    Channel.prototype.initBindings = function () {
        this._onChannels = this._onChannels.bind(this);
        this._onUnreadsForChannels = this._onUnreadsForChannels.bind(this);
        this._onMembersFromChannels = this._onMembersFromChannels.bind(this);
        this._onChannelLastViewed = this._onChannelLastViewed.bind(this);
    };
    Channel.prototype.loadChannels = function () {
        var uri = "/users/me/teams/" + this.client.Team.teamID + "/channels";
        this.client.logger.info("Loading " + uri);
        return this.client.Api.apiCall('GET', uri, null, this._onChannels);
    };
    Channel.prototype.getUserDirectMessageChannel = function (userID, callback) {
        var channel = this.client.me.id + "__" + userID;
        channel = this.findChannelByName(channel);
        if (!channel) {
            channel = userID + "__" + this.client.me.id;
            channel = this.findChannelByName(channel);
        }
        if (channel) {
            if (callback != null) {
                callback(channel);
            }
            return;
        }
        this.createDirectChannel(userID, callback);
    };
    Channel.prototype.loadUnreadsForChannels = function () {
        var uri = '/users/me/teams/unread';
        this.client.logger.info("Loading " + uri);
        return this.client.Api.apiCall('GET', uri, null, this._onUnreadsForChannels);
    };
    Channel.prototype.loadMembersFromChannels = function () {
        var uri = "/users/me/teams/" + this.client.Team.teamID + "/channels/members";
        this.client.logger.info("Loading " + uri);
        return this.client.Api.apiCall('GET', uri, null, this._onMembersFromChannels);
    };
    Channel.prototype.loadChannelLastViewed = function (channelId, prevChannelId) {
        if (prevChannelId === void 0) { prevChannelId = null; }
        var postData = {
            channel_id: channelId,
            prev_channel_id: prevChannelId,
        };
        var uri = '/channels/members/me/view';
        this.client.logger.info("Loading " + uri);
        return this.client.Api.apiCall('POST', uri, postData, this._onChannelLastViewed);
    };
    Channel.prototype.createDirectChannel = function (userID, callback) {
        var _this = this;
        var postData = [userID, this.client.me.id];
        return this.client.Api.apiCall('POST', '/channels/direct', postData, function (data, _headers) {
            _this.client.logger.info('Created Direct Channel.');
            return (callback != null) ? callback(data) : false;
        });
    };
    Channel.prototype.createGroupChannel = function (userIDs, callback) {
        var _this = this;
        return this.client.Api.apiCall('POST', '/channels/group', userIDs, function (data, _headers) {
            _this.client.logger.info('Created Group Channel.');
            return (callback != null) ? callback(data) : false;
        });
    };
    Channel.prototype.createPrivateChannel = function (privateChannel, callback) {
        var _this = this;
        return this.client.Api.apiCall('POST', '/channels', privateChannel, function (data, _headers) {
            _this.client.logger.info('Created Private Channel.');
            return (callback != null) ? callback(data) : false;
        });
    };
    Channel.prototype.addUserToChannel = function (privateChannel, callback) {
        var _this = this;
        var uri = "/channels/" + privateChannel.channel_id + "/members";
        return this.client.Api.apiCall('POST', uri, privateChannel, function (data, _headers) {
            _this.client.logger.info("Added User to Channel " + privateChannel.channel_id);
            return (callback != null) ? callback(data) : false;
        });
    };
    Channel.prototype.setChannelHeader = function (channelID, header) {
        var _this = this;
        var postData = {
            channel_id: channelID,
            channel_header: header,
        };
        return this.client.Api.apiCall('POST', this.client.Team.teamRoute() + "/channels/update_header", postData, function (_data, _headers) {
            _this.client.logger.debug('Channel header updated.');
            return true;
        });
    };
    Channel.prototype.getAllChannels = function () {
        return this._channels;
    };
    Channel.prototype.getChannelByID = function (id) {
        return this._channels[id];
    };
    Channel.prototype._onChannels = function (data, _headers, _params) {
        var _this = this;
        if (data && !data.error) {
            data.forEach(function (channel) {
                _this._channels[channel.id] = channel;
            });
            this.client.logger.info("Found " + Object.keys(data).length + " subscribed channels.");
            return this.client.emit('channelsLoaded', data);
        }
        this.client.logger.error("Failed to get subscribed channels list from server: " + data.error);
        return this.client.emit('error', { msg: 'failed to get channel list' });
    };
    Channel.prototype._onUnreadsForChannels = function (data, _headers, _params) {
        if (data && !data.error) {
            this.client.logger.info("Found " + Object.keys(data).length + " information about unreads.");
            return this.client.emit('channelsUnreadsLoaded', data);
        }
        this.client.logger.error("Failed to get unreads of channels from server: " + data.error);
        return this.client.emit('error', { msg: 'failed to get unreads for channels' });
    };
    Channel.prototype._onMembersFromChannels = function (data, _headers, _params) {
        if (data && !data.error) {
            this.client.logger.info("Found " + Object.keys(data).length + " channels.");
            return this.client.emit('membersFromChannelsLoaded', data);
        }
        this.client.logger.error("Failed to get messages from server: " + data.error);
        return this.client.emit('error', { msg: 'failed to get all members from channels' });
    };
    Channel.prototype._onChannelLastViewed = function (data, _headers, _params) {
        if (data && !data.error) {
            this.client.logger.info("Found " + Object.keys(data).length + " for last reads.");
            return this.client.emit('channelLastViewedLoaded', data);
        }
        this.client.logger.error("Failed to get last reads of channel(s) from server: " + data.error);
        return this.client.emit('error', { msg: 'failed to get last reads for channel(s)' });
    };
    Object.defineProperty(Channel.prototype, "channels", {
        get: function () {
            return this._channels;
        },
        set: function (value) {
            this._channels = value;
        },
        enumerable: true,
        configurable: true
    });
    Channel.prototype.channelRoute = function (channelId) {
        return this.client.Team.teamRoute() + "/channels/" + channelId;
    };
    Channel.prototype.findChannelByName = function (name) {
        var _this = this;
        var foundChannel = Object.keys(this._channels)
            .find(function (channel) {
            var channelName = _this._channels[channel].name;
            var channelDisplayName = _this._channels[channel].display_name;
            return channelName === name || channelDisplayName === name;
        });
        return foundChannel || null;
    };
    return Channel;
}());
exports.default = Channel;
//# sourceMappingURL=channel.js.map