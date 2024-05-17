import { DOMParser } from "deno_dom/deno-dom-wasm.ts";
import { assert } from "@std/assert";
import { assertEquals } from "@std/assert";
import { runBuildAndStartAppFromSubprocess } from "./helpers.ts";

Deno.test({
  name: "Dynamic import",
  async fn(t) {
    const app = await runBuildAndStartAppFromSubprocess(
      "./fixtures/dynimport/",
    );

    await t.step("Works", async () => {
      const resp = await fetch(app.url);
      assertEquals(resp.status, 200, "status is not 200");
      const html = await resp.text();
      assert(html, "html does not exist");
      const doc = new DOMParser().parseFromString(html, `text/html`);
      const div = doc!.querySelector("#thing");
      assert(div, "div does not exist");
    });

    await app.stop();
  },
});
