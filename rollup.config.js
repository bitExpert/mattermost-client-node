import typescript from 'rollup-plugin-typescript';

export default {
    input: 'src/client.ts',
    output: {
        file: 'dist/bundle.js',
        format: 'cjs',
    },
    plugins: [
        typescript(),
    ],
};
