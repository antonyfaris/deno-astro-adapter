import { DOMParser } from "deno_dom/deno-dom-wasm.ts";
import { assert } from "std/assert/assert.ts";
import { assertEquals } from "std/assert/assert_equals.ts";
import { defaultTestPermissions, runBuildAndStartApp } from "./helpers.ts";

// this needs to be here and not in the specific test case, because
// the variables are loaded in the global scope of the built server
// module, which is only executed once upon the first load
const varContent = "this is a value stored in env variable";
Deno.env.set("SOME_VARIABLE", varContent);

Deno.test({
  name: "Astro Content Collections",
  permissions: defaultTestPermissions,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const app = await runBuildAndStartApp("./fixtures/astro-collections/");

    await t.step("Works", async () => {
      const resp = await fetch(app.url);
      assertEquals(resp.status, 200, "status is not 200");
      const html = await resp.text();
      assert(html, "html does not exist");
      const doc = new DOMParser().parseFromString(html, `text/html`);

      if (!doc) throw new Error("Failed to parse HTML document");

      // Check title
      const header = doc.querySelector("h1");
      if (!header) throw new Error("Header not found");
      assertEquals(header.textContent, "Content Collections");

      // Check frontmatter title
      const frontmatterTitle = doc.querySelector("h2");
      if (!frontmatterTitle) throw new Error("Frontmatter title not found");
      assertEquals(frontmatterTitle.textContent, "Sample title 1");

      // Check frontmatter description
      const frontmatterDescription = doc.querySelector("p");
      if (!frontmatterDescription) {
        throw new Error("Frontmatter description not found");
      }
      assertEquals(frontmatterDescription.textContent, "Sample description 1");
    });

    await t.step("Render `<Content /> Component`", async () => {
      const resp = await fetch(`${app.url}/content`);
      assertEquals(resp.status, 200, "status is not 200");
      const html = await resp.text();
      assert(html, "html does not exist");
      const doc = new DOMParser().parseFromString(html, `text/html`);

      if (!doc) throw new Error("Failed to parse HTML document");

      // Check title
      const header = doc.querySelector("h1");
      if (!header) throw new Error("Header not found");
      assertEquals(header.textContent, "Sample Markdown title 1");

      // Check markdown body
      const body = doc.querySelector("p");
      if (!body) throw new Error("Body not found");
      assertEquals(body.textContent, "Sample content 1");
    });

    app.stop();
  },
});
