interface IOptions {
    additionalHeaders?: object;
    autoReconnect?: boolean;
    httpPort?: number;
    logger?: any;
    messageMaxRunes?: number;
    pingInterval?: number;
    useTLS?: boolean;
    wssPort?: number;
}
