// Normal Imports
import { App } from "astro/app";

import { fromFileUrl, serveFile } from "./__deno_imports.ts";

import type { SSRManifest } from "astro";
import type { Options } from "./types.ts";

let _server: Deno.HttpServer | undefined;

async function* getPrerenderedFiles(clientRoot: URL): AsyncGenerator<URL> {
  for await (const ent of Deno.readDir(clientRoot)) {
    if (ent.isDirectory) {
      yield* getPrerenderedFiles(new URL(`./${ent.name}/`, clientRoot));
    } else if (ent.name.endsWith(".html")) {
      yield new URL(`./${ent.name}`, clientRoot);
    }
  }
}

function removeTrailingForwardSlash(path: string) {
  return path.endsWith("/") ? path.slice(0, path.length - 1) : path;
}

export function start(manifest: SSRManifest, options: Options) {
  if (options.start === false) {
    return;
  }

  const clientRoot = new URL("../client/", import.meta.url);
  const app = new App(manifest);
  const handler: Deno.ServeHandler = async (request, connInfo) => {
    if (app.match(request)) {
      const ip = connInfo.remoteAddr.hostname;
      Reflect.set(request, Symbol.for("astro.clientAddress"), ip);

      const response = await app.render(request);
      if (app.setCookieHeaders) {
        for (const setCookieHeader of app.setCookieHeaders(response)) {
          response.headers.append("Set-Cookie", setCookieHeader);
        }
      }
      return response;
    }

    // If the request path wasn't found in astro,
    // try to fetch a static file instead
    const url = new URL(request.url);
    const localPath = new URL("./" + app.removeBase(url.pathname), clientRoot);

    let fileResp = await serveFile(request, fromFileUrl(localPath));

    // Attempt to serve `index.html` if 404
    if (fileResp.status == 404) {
      let fallback;
      for await (const file of getPrerenderedFiles(clientRoot)) {
        const pathname = file.pathname.replace(/\/(index)?\.html$/, "");
        if (removeTrailingForwardSlash(localPath.pathname).endsWith(pathname)) {
          fallback = file;
          break;
        }
      }
      if (fallback) {
        fileResp = await serveFile(request, fromFileUrl(fallback));
      }
    }

    // If the static file can't be found
    if (fileResp.status == 404) {
      // Render the astro custom 404 page
      const response = await app.render(request);

      if (app.setCookieHeaders) {
        for (const setCookieHeader of app.setCookieHeaders(response)) {
          response.headers.append("Set-Cookie", setCookieHeader);
        }
      }
      return response;

      // If the static file is found
    } else {
      return fileResp;
    }
  };

  const hostname = options.hostname ?? "0.0.0.0";

  const port = options.port ?? 8085;
  _server = Deno.serve(
    { port, hostname },
    handler,
  );
}

export function createExports(manifest: SSRManifest, options: Options) {
  const app = new App(manifest);
  return {
    stop() {
      if (_server) {
        _server.shutdown();
        _server = undefined;
      }
    },
    running() {
      return _server !== undefined;
    },
    start() {
      return start(manifest, options);
    },
    handle(request: Request) {
      return app.render(request);
    },
  };
}
