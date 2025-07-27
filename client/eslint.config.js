
import js from '@eslint/js';
import globals from 'globals';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginReactRefresh from 'eslint-plugin-react-refresh';
import tseslintParser from '@typescript-eslint/parser';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';

export default [
  { 
    ignores: [
      'dist', 
      'node_modules', 
      '*.config.js', // Assuming this eslint.config.js will stay JS
      '*.config.ts', // If other configs become TS
      'vite.config.js' // Explicitly ignore vite config if it stays JS
    ] 
  },
  
  // Base JS configuration (primarily for this eslint.config.js itself or other JS utility files)
  {
    files: ['eslint.config.js', 'vite.config.js'], // Be specific for Node environment JS files
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module', // Assuming these config files are ESM
      globals: {
        ...globals.node, 
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    }
  },

  // TypeScript and React specific configuration
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslintParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        project: './tsconfig.json', 
        tsconfigRootDir: import.meta.dirname, 
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin,
      'react-hooks': pluginReactHooks,
      'react-refresh': pluginReactRefresh,
    },
    rules: {
      // Start with ESLint recommended, then TypeScript recommended, then plugin rules
      ...js.configs.recommended.rules, 
      ...typescriptPlugin.configs['eslint-recommended'].rules, 
      ...typescriptPlugin.configs.recommended.rules, 
      // For type-aware linting, consider adding rules from 'recommended-type-checked' later
      // ...typescriptPlugin.configs['recommended-type-checked'].rules,
      
      ...pluginReactHooks.configs.recommended.rules,
      
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      
      // Override/fine-tune rules
      'no-unused-vars': 'off', // Disable base rule, use TS version below
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' , varsIgnorePattern: '^[A-Z_]'}],
      '@typescript-eslint/no-explicit-any': 'warn', // Warn on 'any' for now
      '@typescript-eslint/ban-ts-comment': ['warn', { 
        'ts-expect-error': 'allow-with-description',
        'ts-ignore': 'allow-with-description',
        'ts-nocheck': true,
        'ts-check': false,
        minimumDescriptionLength: 3,
      }],
      // Add other rules or overrides as needed during migration
    },
  },
];