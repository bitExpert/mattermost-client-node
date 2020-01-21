import {
    authenticationTests,
    channelsTests,
    initConstants,
    optionsTests,
    teamsTests,
    usersTests,
    websocketTests,
} from './testsuite-loader';

export default (type, Client) => {
    initConstants();

    let info = `sequentially run ${type} bundle tests`;
    if (type === 'src') {
        info = 'sequentially run tests';
    }

    // eslint-disable-next-line
    describe(info, () => {
        authenticationTests(Client);
        channelsTests(Client);
        optionsTests(Client);
        teamsTests(Client);
        usersTests(Client);
        websocketTests(Client);
    });
};
