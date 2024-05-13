import { defineConfig } from 'astro/config';
import db from "@astrojs/db";
import deno from '@antonyfaris/deno-astro-adapter';

export default defineConfig({
	adapter: deno(),
	integrations: [db()],
	output: 'server'
})
