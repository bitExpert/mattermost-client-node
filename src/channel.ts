class Channel {
    client: any;

    usersRoute: string;

    private _channels: any = {};

    constructor(
        client: any,
        usersRoute: string,
    ) {
        this.client = client;
        this.usersRoute = usersRoute;

        this.initBindings();
    }

    initBindings(): any {
        this._onChannels = this._onChannels.bind(this);
        this._onUnreadsForChannels = this._onUnreadsForChannels.bind(this);
        this._onMembersFromChannels = this._onMembersFromChannels.bind(this);
        this._onChannelLastViewed = this._onChannelLastViewed.bind(this);
    }


    /**
     * get channel(s) / channel information
     */

    loadChannels(): any {
        const uri = `/users/me/teams/${this.client.teamID}/channels`;
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall('GET', uri, null, this._onChannels);
    }

    // @Todo tests
    getUserDirectMessageChannel(userID: string, callback: any): any {
        // check if channel already exists
        let channel = `${this.client.self.id}__${userID}`;
        channel = this.findChannelByName(channel);
        if (!channel) {
            // check if channel in other direction exists
            channel = `${userID}__${this.client.self.id}`;
            channel = this.findChannelByName(channel);
        }
        if (channel) {
            if (callback != null) { callback(channel); }
            return;
        }
        // channel obviously doesn't exist, let's create it
        this.createDirectChannel(userID, callback);
    }

    // @Todo tests
    loadUnreadsForChannels(): any {
        const uri = '/users/me/teams/unread';
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall('GET', uri, null, this._onUnreadsForChannels);
    }

    // @Todo tests
    // method is needed e.g. to get detailed unreads (channels and direct messages)
    // iterate over this.Channel.channels and substract msg_count (result from this call)
    // from this.Channel.channels.total_msg_count
    loadMembersFromChannels(): any {
        const uri = `/users/me/teams/${this.client.teamID}/channels/members`;
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall('GET', uri, null, this._onMembersFromChannels);
    }

    // @Todo tests
    // to mark messages as read (e.g. after loading messages of channel)
    // trigger loadChannelLastViewed method
    loadChannelLastViewed(channelId: string, prevChannelId: string | null = null): any {
        const postData = {
            // eslint-disable-next-line @typescript-eslint/camelcase
            channel_id: channelId,
            // eslint-disable-next-line @typescript-eslint/camelcase
            prev_channel_id: prevChannelId,
        };
        const uri = '/channels/members/me/view';
        this.client.logger.info(`Loading ${uri}`);
        return this.client.Api.apiCall('POST', uri, postData, this._onChannelLastViewed);
    }


    /**
     * create channel(s) / edit channel(s)
     */

    // type "D" = Direct Messages
    // @Todo tests
    createDirectChannel(userID: string, callback: any): any {
        const postData = [userID, this.client.self.id];
        return this.client.Api.apiCall(
            'POST',
            '/channels/direct',
            postData,
            (data: any, _headers: any) => {
                this.client.logger.info('Created Direct Channel.');
                return (callback != null) ? callback(data) : false;
            },
        );
    }

    // type "G" = Public Channels
    // @Todo tests
    createGroupChannel(userIDs: string, callback: any): any {
        return this.client.Api.apiCall(
            'POST',
            '/channels/group',
            userIDs,
            (data: any, _headers: any) => {
                this.client.logger.info('Created Group Channel.');
                return (callback != null) ? callback(data) : false;
            },
        );
    }

    // type "P" = Private Channels
    // @Todo tests
    createPrivateChannel(privateChannel: any, callback: any): any {
        return this.client.Api.apiCall(
            'POST',
            '/channels',
            privateChannel,
            (data: any, _headers: any) => {
                this.client.logger.info('Created Private Channel.');
                return (callback != null) ? callback(data) : false;
            },
        );
    }

    // @Todo tests
    addUserToChannel(privateChannel: any, callback: any): any {
        const uri = `/channels/${privateChannel.channel_id}/members`;
        return this.client.Api.apiCall(
            'POST',
            uri,
            privateChannel,
            (data: any, _headers: any) => {
                this.client.logger.info(`Added User to Channel ${privateChannel.channel_id}`);
                return (callback != null) ? callback(data) : false;
            },
        );
    }

    // @Todo tests
    setChannelHeader(channelID: string, header: any): any {
        const postData = {
            // eslint-disable-next-line @typescript-eslint/camelcase
            channel_id: channelID,
            // eslint-disable-next-line @typescript-eslint/camelcase
            channel_header: header,
        };

        return this.client.Api.apiCall(
            'POST',
            `${this.client.teamRoute()}/channels/update_header`,
            postData,
            (_data: any, _headers: any) => {
                this.client.logger.debug('Channel header updated.');
                return true;
            },
        );
    }


    /**
     * return channel(s)
     */

    // @Todo tests
    getAllChannels(): Record<string, any> {
        return this._channels;
    }

    // @Todo tests
    getChannelByID(id: string): Record<string, any> {
        return this._channels[id];
    }

    /**
     * callbacks
     */

    private _onChannels(data: any, _headers: any, _params: any): any {
        if (data && !data.error) {
            data.forEach((channel: IChannel) => {
                this._channels[channel.id] = channel;
            });
            this.client.logger.info(`Found ${Object.keys(data).length} subscribed channels.`);
            return this.client.emit('channelsLoaded', data);
        }
        this.client.logger.error(`Failed to get subscribed channels list from server: ${data.error}`);
        return this.client.emit('error', { msg: 'failed to get channel list' });
    }

    private _onUnreadsForChannels(data: any, _headers: any, _params: any): any {
        if (data && !data.error) {
            this.client.logger.info(`Found ${Object.keys(data).length} information about unreads.`);
            return this.client.emit('channelsUnreadsLoaded', data);
        }
        this.client.logger.error(`Failed to get unreads of channels from server: ${data.error}`);
        return this.client.emit('error', { msg: 'failed to get unreads for channels' });
    }

    private _onMembersFromChannels(data: any, _headers: any, _params: any): any {
        if (data && !data.error) {
            this.client.logger.info(`Found ${Object.keys(data).length} channels.`);
            return this.client.emit('membersFromChannelsLoaded', data);
        }
        this.client.logger.error(`Failed to get messages from server: ${data.error}`);
        return this.client.emit('error', { msg: 'failed to get all members from channels' });
    }

    private _onChannelLastViewed(data: any, _headers: any, _params: any): any {
        if (data && !data.error) {
            this.client.logger.info(`Found ${Object.keys(data).length} for last reads.`);
            return this.client.emit('channelLastViewedLoaded', data);
        }
        this.client.logger.error(`Failed to get last reads of channel(s) from server: ${data.error}`);
        return this.client.emit('error', { msg: 'failed to get last reads for channel(s)' });
    }


    /**
     * getter & setter
     */

    get channels(): any {
        return this._channels;
    }

    set channels(value: any) {
        this._channels = value;
    }


    /**
     * helpers
     */

    channelRoute(channelId: string): string {
        return `${this.client.teamRoute()}/channels/${channelId}`;
    }

    findChannelByName(name: string): string | null {
        const foundChannel = Object.keys(this._channels)
            .find((channel: any) => {
                const channelName = this._channels[channel].name;
                const channelDisplayName = this._channels[channel].display_name;
                return channelName === name || channelDisplayName === name;
            });
        return foundChannel || null;
    }
}

export default Channel;
