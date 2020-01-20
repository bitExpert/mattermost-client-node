class User {
    private _users: any = {};

    getUserByID(id: string): Record<string, any> {
        return this._users[id];
    }

    getUserByEmail(email: string): Record<string, any> {
        return Object.values(this._users)
            .find((user: any) => user.email === email);
    }

    getAllUsers(): any {
        return this._users;
    }

    get users(): any {
        return this._users;
    }

    set users(value: any) {
        this._users = value;
    }
}

export default User;
