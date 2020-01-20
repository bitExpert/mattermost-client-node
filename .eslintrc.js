module.exports = {
    env: {
        browser: true,
        commonjs: true,
        es6: true,
        node: true,
    },
    extends: [
        'airbnb-base',
        'plugin:@typescript-eslint/recommended'
    ],
    globals: {
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2018
    },
    settings: {
        'import/resolver': {
            'node': {
                'extensions': ['.js', '.ts']
            }
        }
    },
    plugins: ['@typescript-eslint'],
    rules: {
        'indent': [2, 4],
        'no-underscore-dangle': 'off',
        'camelcase': 'off',
        '@typescript-eslint/interface-name-prefix': [
            'error',
            'always'
        ],
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': [2, {'args': 'after-used', 'argsIgnorePattern': '^_'}],
        'import/extensions': [
            'error',
            'ignorePackages',
            {
                'js': 'never',
                'jsx': 'never',
                'ts': 'never',
                'tsx': 'never'
            }
        ]
    },
    overrides: [
        {
            'files': ['tests/**/*.js'],
            'rules': {'@typescript-eslint/explicit-function-return-type': 'off'}
        }
    ]
};
