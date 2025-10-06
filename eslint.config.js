import js from '@eslint/js';
import ts_parser from '@typescript-eslint/parser';
import ts_plugin from '@typescript-eslint/eslint-plugin';

export default [
	{
		ignores: ['dist', 'node_modules']
	},
	js.configs.recommended,
	{
		files: ['**/*.ts', '**/*.tsx'],
		languageOptions: {
			parser: ts_parser,
			parserOptions: {
				project: ['./tsconfig.json'],
				tsconfigRootDir: import.meta.dirname,
				sourceType: 'module'
			}
		},
		plugins: {
			'@typescript-eslint': ts_plugin
		},
		rules: {
			...ts_plugin.configs.recommended.rules,
			...ts_plugin.configs['recommended-requiring-type-checking'].rules,
			'no-tabs': 'off',
			'indent': ['error', 'tab'],
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
		}
	}
];
