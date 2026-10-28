import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// adapter-cloudflare builds for Workers Static Assets.
			// Deploy via Cloudflare Git integration (Workers Builds):
			// build `pnpm run build`, output `.svelte-kit/cloudflare`.
			adapter: adapter({
				fallback: 'spa'
			})
		})
	]
});
