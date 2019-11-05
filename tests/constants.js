global.CONNECTION = {
    httpPort: 8065,
    wsPort: 443,
    host: 'localhost',
};

global.ADMIN = {
    username: 'admin',
    email: 'admin@example.com',
    password: 'Admin12345!',
    group: 'privateteam',
};

ADMIN.mock = {
    id: expect.any(String),
    create_at: expect.any(Number),
    update_at: expect.any(Number),
    delete_at: 0,
    username: ADMIN.username,
    auth_data: '',
    auth_service: '',
    email: ADMIN.email,
    nickname: '',
    first_name: '',
    last_name: '',
    position: '',
    roles: expect.any(String),
    notify_props: {
        channel: 'true',
        comments: 'never',
        desktop: 'mention',
        desktop_sound: 'true',
        email: 'true',
        first_name: 'false',
        mention_keys: 'admin,@admin',
        push: 'mention',
        push_status: 'away',
    },
    locale: 'en',
    timezone: {
        automaticTimezone: '',
        manualTimezone: '',
        useAutomaticTimezone: 'true',
    },
};

global.USER = {
    username: 'user',
    email: 'user@example.com',
    password: 'User12345!',
    group: 'privateteam',
};

USER.mock = {
    id: expect.any(String),
    create_at: expect.any(Number),
    update_at: expect.any(Number),
    delete_at: 0,
    username: USER.username,
    auth_data: '',
    auth_service: '',
    email: USER.email,
    nickname: '',
    first_name: '',
    last_name: '',
    position: '',
    roles: expect.any(String),
    notify_props: {
        channel: 'true',
        comments: 'never',
        desktop: 'mention',
        desktop_sound: 'true',
        email: 'true',
        first_name: 'false',
        mention_keys: 'user,@user',
        push: 'mention',
        push_status: 'away',
    },
    locale: 'en',
    timezone: {
        automaticTimezone: '',
        manualTimezone: '',
        useAutomaticTimezone: 'true',
    },
};

global.ALLUSERS = {
    mock: {
        id: expect.any(String),
        create_at: expect.any(Number),
        update_at: expect.any(Number),
        delete_at: 0,
        username: expect.any(String),
        auth_data: '',
        auth_service: '',
        email: expect.any(String),
        nickname: '',
        first_name: '',
        last_name: '',
        position: '',
        roles: expect.any(String),
        locale: 'en',
        timezone: {
            automaticTimezone: '',
            manualTimezone: '',
            useAutomaticTimezone: 'true',
        },
    },
};

global.PRIVATECHANNEL = 'privatechannel';
global.PUBLICCHANNEL = 'publicchannel';
