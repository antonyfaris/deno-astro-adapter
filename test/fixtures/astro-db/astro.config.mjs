import { defineConfig, passthroughImageService } from 'astro/config';
import db from "@astrojs/db";
import deno from '@astrojs/deno';

export default defineConfig({
	adapter: deno(),
	integrations: [db()],
	output: 'server',
	image: {
    service: passthroughImageService(),
  },
})
