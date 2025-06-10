import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import treesitter from 'eslint-config-treesitter';

export default defineConfig([
	{
		extends: [treesitter, prettier],
	},
]);
