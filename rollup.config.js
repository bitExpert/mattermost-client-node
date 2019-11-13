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
        },
        plugins: [
            typescript(),
            json(),
            resolve({
                preferBuiltins: true,
                browser: true,
            }),
            commonjs({
                include: [
                    /node_modules/
                ],
            }),
            builtins(),
        ],
    },
];
