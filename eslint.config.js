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

// Components used only in JSX (<Badge />) count as used, so no-unused-vars stays accurate in .jsx files.
const jsxUsesVars = {
  create(context) {
    const markUsed = (node) => {
      let name = node.name;
      while (name.type === 'JSXMemberExpression') name = name.object;
      if (name.type === 'JSXIdentifier') context.sourceCode.markVariableAsUsed(name.name, node);
    };
    return { JSXOpeningElement: markUsed };
  },
};

const unusedVars = [
  'warn',
  { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
];

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
    rules: { 'no-unused-vars': unusedVars },
  },
  {
    files: ['client/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    plugins: { local: { rules: { 'jsx-uses-vars': jsxUsesVars } } },
    rules: { 'no-unused-vars': unusedVars, 'local/jsx-uses-vars': 'error' },
  },
  {
    files: ['client/vite.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['server/src/moderation/ai/**/*.js'],
    rules: AI_IMPORT_RULE,
  },
];
