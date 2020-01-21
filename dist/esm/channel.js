class Channel {
    constructor(client, usersRoute) {
        this._channels = {};
        this.client = client;
        this.usersRoute = usersRoute;
        this.initBindings();
    }
    initBindings() {
        this._onChannels = this._onChannels.bind(this);
        this._onUnreadsForChannels = this._onUnreadsForChannels.bind(this);
        this._onMembersFromChannels = this._onMembersFromChannels.bind(this);
        this._onChannelLastViewed = this._onChannelLastViewed.bind(this);
    }
    loadChannels() {
        const uri = `/users/me/teams/${this.client.Team.teamID}/channels`;
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall('GET', uri, null, this._onChannels);
    }
    getUserDirectMessageChannel(userID, callback) {
        let channel = `${this.client.me.id}__${userID}`;
        channel = this.findChannelByName(channel);
        if (!channel) {
            channel = `${userID}__${this.client.me.id}`;
            channel = this.findChannelByName(channel);
        }
        if (channel) {
            if (callback != null) {
                callback(channel);
            }
            return;
        }
        this.createDirectChannel(userID, callback);
    }
    loadUnreadsForChannels() {
        const uri = '/users/me/teams/unread';
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall('GET', uri, null, this._onUnreadsForChannels);
    }
    loadMembersFromChannels() {
        const uri = `/users/me/teams/${this.client.Team.teamID}/channels/members`;
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall('GET', uri, null, this._onMembersFromChannels);
    }
    loadChannelLastViewed(channelId, prevChannelId = null) {
        const postData = {
            channel_id: channelId,
            prev_channel_id: prevChannelId,
        };
        const uri = '/channels/members/me/view';
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall('POST', uri, postData, this._onChannelLastViewed);
    }
    createDirectChannel(userID, callback) {
        const postData = [userID, this.client.me.id];
        return this.client.Api.apiCall('POST', '/channels/direct', postData, (data, _headers) => {
            this.client.logger.info('Created Direct Channel.');
            return (callback != null) ? callback(data) : false;
        });
    }
    createGroupChannel(userIDs, callback) {
        return this.client.Api.apiCall('POST', '/channels/group', userIDs, (data, _headers) => {
            this.client.logger.info('Created Group Channel.');
            return (callback != null) ? callback(data) : false;
        });
    }
    createPrivateChannel(privateChannel, callback) {
        return this.client.Api.apiCall('POST', '/channels', privateChannel, (data, _headers) => {
            this.client.logger.info('Created Private Channel.');
            return (callback != null) ? callback(data) : false;
        });
    }
    addUserToChannel(privateChannel, callback) {
        const uri = `/channels/${privateChannel.channel_id}/members`;
        return this.client.Api.apiCall('POST', uri, privateChannel, (data, _headers) => {
            this.client.logger.info(`Added User to Channel ${privateChannel.channel_id}`);
            return (callback != null) ? callback(data) : false;
        });
    }
    setChannelHeader(channelID, header) {
        const postData = {
            channel_id: channelID,
            channel_header: header,
        };
        return this.client.Api.apiCall('POST', `${this.client.Team.teamRoute()}/channels/update_header`, postData, (_data, _headers) => {
            this.client.logger.debug('Channel header updated.');
            return true;
        });
    }
    getAllChannels() {
        return this._channels;
    }
    getChannelByID(id) {
        return this._channels[id];
    }
    _onChannels(data, _headers, _params) {
        if (data && !data.error) {
            data.forEach((channel) => {
                this._channels[channel.id] = channel;
            });
            this.client.logger.info(`Found ${Object.keys(data).length} subscribed channels.`);
            return this.client.emit('channelsLoaded', data);
        }
        this.client.logger.error(`Failed to get subscribed channels list from server: ${data.error}`);
        return this.client.emit('error', { msg: 'failed to get channel list' });
    }
    _onUnreadsForChannels(data, _headers, _params) {
        if (data && !data.error) {
            this.client.logger.info(`Found ${Object.keys(data).length} information about unreads.`);
            return this.client.emit('channelsUnreadsLoaded', data);
        }
        this.client.logger.error(`Failed to get unreads of channels from server: ${data.error}`);
        return this.client.emit('error', { msg: 'failed to get unreads for channels' });
    }
    _onMembersFromChannels(data, _headers, _params) {
        if (data && !data.error) {
            this.client.logger.info(`Found ${Object.keys(data).length} channels.`);
            return this.client.emit('membersFromChannelsLoaded', data);
        }
        this.client.logger.error(`Failed to get messages from server: ${data.error}`);
        return this.client.emit('error', { msg: 'failed to get all members from channels' });
    }
    _onChannelLastViewed(data, _headers, _params) {
        if (data && !data.error) {
            this.client.logger.info(`Found ${Object.keys(data).length} for last reads.`);
            return this.client.emit('channelLastViewedLoaded', data);
        }
        this.client.logger.error(`Failed to get last reads of channel(s) from server: ${data.error}`);
        return this.client.emit('error', { msg: 'failed to get last reads for channel(s)' });
    }
    get channels() {
        return this._channels;
    }
    set channels(value) {
        this._channels = value;
    }
    channelRoute(channelId) {
        return `${this.client.Team.teamRoute()}/channels/${channelId}`;
    }
    findChannelByName(name) {
        const foundChannel = Object.keys(this._channels)
            .find((channel) => {
            const channelName = this._channels[channel].name;
            const channelDisplayName = this._channels[channel].display_name;
            return channelName === name || channelDisplayName === name;
        });
        return foundChannel || null;
    }
}
export default Channel;
//# sourceMappingURL=channel.js.map