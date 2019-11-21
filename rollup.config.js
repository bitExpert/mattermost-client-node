import typescript from 'rollup-plugin-typescript';

export default [
    {
        input: 'src/client.ts',
        output: {
            file: 'dist/bundle.esm.js',
            format: 'esm',
        },
        plugins: [
            typescript(),
        ],
    },
    {
        input: 'src/client.ts',
        output: {
            file: 'dist/bundle.cjs.js',
            format: 'cjs',
        },
        plugins: [
            typescript(),
        ],
    },
    /* {
        input: 'src/client.ts',
        output: {
            file: 'dist/bundle.umd.js',
            format: 'umd',
            name: 'mattermostClient',
            exports: 'named',
        },
        globals: {
            ws: 'WebSocket',
            // todo: check if we need more globals
        },
        plugins: [
            resolve({
                browser: false,
            }),
            commonjs({
                include: [
                    /node_modules/,
                ],
            }),
            json(),
            typescript(),
        ],
    }, */
];
