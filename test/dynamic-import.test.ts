/* Deno types consider DOM elements nullable */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.35-alpha/deno-dom-wasm.ts';
import { assert, assertEquals } from 'https://deno.land/std@0.158.0/testing/asserts.ts';
import { runBuildAndStartApp } from './helpers.ts';

Deno.test({
	name: 'Dynamic import',
	async fn(t) {
		const app = await runBuildAndStartApp('./fixtures/dynimport/');

		await t.step('Works', async () => {
			const resp = await fetch(app.url);
			assertEquals(resp.status, 200, 'status is not 200');
			const html = await resp.text();
			assert(html, 'html does not exist');
			const doc = new DOMParser().parseFromString(html, `text/html`);
			const div = doc!.querySelector('#thing');
			assert(div, 'div does not exist');
		});

		app.stop();
	},
});