/**
 * ESLint flat config — supports .mjs (ESM) files.
 * Lints both cli/ and test/ directories.
 */
import js from '@eslint/js';

export default [
  {
    ignores: ['node_modules/', 'history/', '.git/'],
  },
  js.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 'latest',
      globals: {
        // Node.js globals (not in browser)
        URL: 'readonly',        // URL constructor
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Buffer: 'readonly',
        __dirname: 'off',     // not available in ESM
        __filename: 'off',    // not available in ESM
        require: 'off',       // not available in ESM
        module: 'off',        // not available in ESM
        exports: 'off',       // not available in ESM
      },
    },
    rules: {
      // Clean code basics
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',               // CLI tool — console is intentional
      'prefer-const': 'warn',
      'no-var': 'error',
      'eqeqeq': ['warn', 'always'],
      'curly': ['warn', 'all'],
      'no-throw-literal': 'warn',
      'prefer-promise-reject-errors': 'warn',
      'no-undef': 'error',
    },
  },
];
