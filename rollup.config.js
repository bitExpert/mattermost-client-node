import typescript from 'rollup-plugin-typescript';
import nodePolyfills from 'rollup-plugin-node-polyfills';
// import resolve from 'rollup-plugin-node-resolve';
// import commonjs from 'rollup-plugin-commonjs';
// import json from 'rollup-plugin-commonjs';

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
    // {
    //     input: 'src/client.ts',
    //     output: {
    //         file: 'dist/bundle.umd.js',
    //         format: 'umd',
    //         name: 'mattermostClient',
    //     },
    //     plugins: [
    //         // commonjs(),
    //         // json(),
    //         typescript(),
    //         nodePolyfills(),
    //     ],
    // },
];
