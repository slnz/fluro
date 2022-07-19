module.exports = {
  extends: [
    'plugin:import/recommended',
    'plugin:import/typescript',
    'eslint-config-standard',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended'
  ],
  overrides: [
    {
      files: ['**/*.spec.tsx', '**/*.spec.ts', 'src/setupTests.ts'],
      rules: {
        '@typescript-eslint/no-empty-function': ['off']
      }
    },
    {
      files: ['**/*.stories.*'],
      rules: {
        'import/no-anonymous-default-export': 'off'
      }
    },
    {
      files: ['**/*.js'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-useless-constructor': 'off',
        'no-useless-constructor': 'error'
      }
    }
  ],
  plugins: ['@typescript-eslint', 'prettier', 'import'],
  parser: '@typescript-eslint/parser',
  rules: {
    'import/no-absolute-path': 'error',
    'import/no-restricted-paths': 'error',
    'import/no-dynamic-require': 'error',
    'import/no-webpack-loader-syntax': 'error',
    'import/no-self-import': 'error',
    'import/no-cycle': 'warn',
    'import/no-useless-path-segments': 'error',
    'import/no-relative-packages': 'error',
    'import/no-mutable-exports': 'error',
    'import/no-unused-modules': 'error',
    'import/no-amd': 'error',
    'import/first': 'error',
    'import/no-namespace': 'error',
    'import/order': [
      'error',
      {
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true }
      }
    ],
    'import/newline-after-import': 'error',
    'import/no-named-default': 'error',
    'import/no-anonymous-default-export': 'error',
    'import/dynamic-import-chunkname': 'error',
    'no-useless-constructor': 'off',
    '@typescript-eslint/no-useless-constructor': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    // '@typescript-eslint/explicit-function-return-type': 'error'
  }
}
