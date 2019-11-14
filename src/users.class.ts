import Client from './client';

class ClientUsers extends Client {
    getAllUsers() {
        return this.users;
    }
}

export default ClientUsers;
