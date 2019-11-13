import typescript from 'rollup-plugin-typescript';
import resolve from 'rollup-plugin-node-resolve';
import builtins from 'rollup-plugin-node-builtins';
import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';

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
    {
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
    },
];
