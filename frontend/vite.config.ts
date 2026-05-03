import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	build: {
		rolldownOptions: {
			onLog(level, log, defaultHandler) {
				if (level === 'warn' && log.code === 'EVAL' && log.id?.includes('/node_modules/file-type/core.js')) {
					return;
				}

				if (level === 'warn' && log.code === 'PLUGIN_TIMINGS') {
					return;
				}

				defaultHandler(level, log);
			}
		}
	},
	plugins: [
		tailwindcss(),
		sveltekit(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/shared/paraglide',
			strategy: ['cookie', 'globalVariable', 'preferredLanguage', 'baseLocale']
		})
	],
	server: {
		proxy: {
			'/api': {
				target: 'http://127.0.0.1:8787',
				changeOrigin: false
			}
		}
	}
});
