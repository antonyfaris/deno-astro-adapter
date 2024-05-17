import { DOMParser } from "deno_dom/deno-dom-wasm.ts";
import { assert } from "@std/assert";
import { assertEquals } from "@std/assert";
import { defaultTestPermissions, runBuildAndStartApp } from "./helpers.ts";

Deno.test({
  name: "Astro Images",
  permissions: defaultTestPermissions,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const app = await runBuildAndStartApp("./fixtures/astro-images/");

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
      assertEquals(header.textContent, "Images");

      // Check images
      const images = doc.querySelectorAll("img");
      assertEquals(images.length, 2, "Incorrect number of images");

      const image1 = doc.querySelector("img#img-1");
      const image2 = doc.querySelector("img#img-2");

      if (!image1 || !image2) {
        throw new Error("Images not found");
      }

      const image1Url = new URL(image1.getAttribute("src")!, app.url);
      const image1Resp = await fetch(image1Url.href);
      assertEquals(image1Resp.status, 200, "status is not 200");

      const image2Url = new URL(image1.getAttribute("src")!, app.url);
      const image2Resp = await fetch(image2Url.href);
      assertEquals(image2Resp.status, 200, "status is not 200");
    });

    app.stop();
  },
});
