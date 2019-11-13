import Client from './client';

class Users extends Client {
    constructor(host: string, group: string, options: any) {
        super(host, group, options);
        this.users = [];
    }
}

export default Users;
