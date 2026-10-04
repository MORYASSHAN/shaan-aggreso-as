import js from '@eslint/js';
import globals from 'globals';

// The AI code must have no way to change content or appeals, so it may never import decisionService.
export const AI_IMPORT_RULE = {
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['**/decisionService', '**/decisionService.js'],
          message: 'moderation/ai must never import decisionService: the AI recommends, humans decide.',
        },
      ],
    },
  ],
};

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
    rules: {
      'no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['server/src/moderation/ai/**/*.js'],
    rules: AI_IMPORT_RULE,
  },
];
