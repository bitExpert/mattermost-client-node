class User {
    constructor(data) {
        if (data) {
            Object.entries(data).forEach(([key, value]) => {
                this[key] = value;
            });
        }
    }
}

module.exports = User;
