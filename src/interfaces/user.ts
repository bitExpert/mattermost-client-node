interface IUser {
    id: string;
    create_at: number;
    update_at: number;
    delete_at: number;
    username: string;
    auth_data: string;
    auth_service: string;
    email: string;
    nickname: string;
    first_name: string;
    last_name: string;
    position: string;
    roles: string;
    notify_props?: INotifyProps;
    last_password_update?: number;
    locale: string;
    timezone: {
        automaticTimezone: string;
        manualTimezone: string;
        useAutomaticTimezone: boolean;
    };
    isbot?: boolean;
    bot_description?: string;
}
