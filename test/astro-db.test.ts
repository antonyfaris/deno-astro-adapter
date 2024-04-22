import { DOMParser } from "deno_dom/deno-dom-wasm.ts";
import { assert } from "std/assert/assert.ts";
import { assertEquals } from "std/assert/assert_equals.ts";
import { defaultTestPermissions, runBuildAndStartApp } from "./helpers.ts";

// this needs to be here and not in the specific test case, because
// the variables are loaded in the global scope of the built server
// module, which is only executed once upon the first load
const varContent = "this is a value stored in env variable";
Deno.env.set("SOME_VARIABLE", varContent);
Deno.env.set("ASTRO_DATABASE_FILE", "./astro");

Deno.test({
  name: "Astro DB",
  permissions: defaultTestPermissions,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const app = await runBuildAndStartApp("./fixtures/astro-db/");

    await t.step("Works", async () => {
      const resp = await fetch(app.url);
      assertEquals(resp.status, 200, "status is not 200");
      const html = await resp.text();
      assert(html, "html does not exist");
      const doc = new DOMParser().parseFromString(html, `text/html`);

      if (!doc) throw new Error("Failed to parse HTML document");

      // Test title
      const header = doc.querySelector("h2");
      if (!header) throw new Error("Header not found");
      assertEquals(header.textContent, "Comments");

      // Test author and comments
      const expectedComments = [
        { author: "John", body: "Hello!" },
        { author: "Jane", body: "Hi!" },
      ];

      expectedComments.forEach((expected, i) => {
        // Test author and comments
        const article = doc.querySelector(`#article-${i}`);
        if (!article) throw new Error("Article not found");

        const authorParagraph = article.querySelector(".author");
        const commentParagraph = article.querySelector(".comment");

        if (!authorParagraph || !commentParagraph) {
          throw new Error("Paragraphs within the article not found");
        }

        const authorText = authorParagraph.textContent.trim();
        const commentText = commentParagraph.textContent.trim();

        assertEquals(
          authorText,
          `Author: ${expected.author}`,
          `Incorrect author in article ${i}`,
        );
        assertEquals(
          commentText,
          expected.body,
          `Incorrect comment in article ${i}`,
        );
      });
    });

    app.stop();
  },
});
