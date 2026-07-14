import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Flat config covering the whole workspace. Two style zones, mirroring
// readysetcloud/content-tracking: backend Lambda code is plain ESM `.mjs`,
// while the packages and the frontend are TypeScript. The frontend brings
// its own React-aware config (example/frontend/eslint.config.js).
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.aws-sam/**',
      '**/coverage/**',
      'example/frontend/**',
    ],
  },

  // Backend Lambda functions + operational scripts (plain ESM JavaScript).
  {
    files: ['example/backend/**/*.mjs', 'scripts/**/*.mjs'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },

  // TypeScript packages (@readysetcloud/agent, @readysetcloud/ui) + the
  // AgentCore agent artifact.
  ...tseslint.config({
    files: ['packages/**/*.ts', 'packages/**/*.tsx', 'example/backend/agent/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  }),
];
