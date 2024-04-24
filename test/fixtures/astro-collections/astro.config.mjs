import { defineConfig } from 'astro/config';
import deno from '@astrojs/deno';

export default defineConfig({
	adapter: deno(),
	integrations: [],
	output: 'server'
})
