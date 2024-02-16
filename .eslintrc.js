module.exports = {
    'env': {
        'node': true,
        'commonjs': true,
        'es2021': true,
        'mocha': true
    },
    'extends': [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended'
    ],
    'parser': '@typescript-eslint/parser',
    'parserOptions': {
        'ecmaVersion': 13,
        'sourceType': 'module',
    },
    'rules': {
        'quotes': ['error', 'single'],
        'semi': ['error', 'always'],
        'eqeqeq': ['error', 'always']
    }
};
