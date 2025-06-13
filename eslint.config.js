const js = require('@eslint/js');
const importPlugin = require('eslint-plugin-import');
const node = require('eslint-plugin-node');
const jsdoc = require('eslint-plugin-jsdoc');
const promise = require('eslint-plugin-promise');
const simpleImportSort = require('eslint-plugin-simple-import-sort');
const unusedImports = require('eslint-plugin-unused-imports');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'commonjs',
            globals: {
                console: true,
                process: true,
                setTimeout: true,
                setInterval: true,
                clearInterval: true,
                clearTimeout: true,
                Buffer: true,
                __dirname: true,
                __filename: true
            }
        },
        plugins: {
            import: importPlugin,
            node,
            jsdoc,
            promise,
            'simple-import-sort': simpleImportSort,
            'unused-imports': unusedImports
        },
        rules: {
            'no-console': 'off',
            'unused-imports/no-unused-vars': [
                'warn',
                {
                    vars: 'all',
                    varsIgnorePattern: '^_',
                    args: 'after-used',
                    argsIgnorePattern: '^_'
                }
            ]
        }
    }
];
