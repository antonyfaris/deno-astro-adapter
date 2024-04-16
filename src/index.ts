import type { AstroAdapter, AstroIntegration } from "astro";
import esbuild from "esbuild";
import * as fs from "node:fs";
import * as npath from "node:path";
import { fileURLToPath } from "node:url";
import type { BuildConfig, Options } from "./types.ts";

const SHIM = `globalThis.process = {
	argv: [],
	env: Deno.env.toObject(),
};`;

const DENO_VERSION = `0.222.1`;
// REF: https://github.com/denoland/deno/tree/main/ext/node/polyfills
const COMPATIBLE_NODE_MODULES = [
  "assert",
  "assert/strict",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "diagnostics_channel",
  "dns",
  "events",
  "fs",
  "fs/promises",
  "http",
  // 'http2',
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "path/posix",
  "path/win32",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "stream/promises",
  "stream/web",
  "string_decoder",
  "sys",
  "timers",
  "timers/promises",
  // 'tls',
  "trace_events",
  "tty",
  "url",
  "util",
  "util/types",
  // 'v8',
  // 'vm',
  // 'wasi',
  // 'webcrypto',
  "worker_threads",
  "zlib",
];

// We shim deno-specific imports so we can run the code in Node
// to prerender pages. In the final Deno build, this import is
// replaced with the Deno-specific contents listed below.
const DENO_IMPORTS_SHIM = `@astrojs/deno/__deno_imports.ts`;
const DENO_IMPORTS =
  `export { Server } from "https://deno.land/std@${DENO_VERSION}/http/server.ts"
export { serveFile } from 'https://deno.land/std@${DENO_VERSION}/http/file_server.ts';
export { fromFileUrl } from "https://deno.land/std@${DENO_VERSION}/path/mod.ts";`;

export function getAdapter(opts?: Options): AstroAdapter {
  return {
    name: "@astrojs/deno",
    serverEntrypoint: "@astrojs/deno/server.ts",
    args: opts ?? {},
    exports: ["stop", "handle", "start", "running"],
    supportedAstroFeatures: {
      hybridOutput: "stable",
      staticOutput: "stable",
      serverOutput: "stable",
      assets: {
        supportKind: "stable",
        isSharpCompatible: false,
        isSquooshCompatible: false,
      },
    },
  };
}

const denoImportsShimPlugin = {
  name: "@astrojs/deno:shim",
  setup(build: esbuild.PluginBuild) {
    build.onLoad({ filter: /__deno_imports\.ts$/ }, async () => {
      return {
        contents: DENO_IMPORTS,
        loader: "ts",
      };
    });
  },
};

/**
 * Read environment variable with compatibility for Deno and Node
 */
function readEnvVar(varName: string) {
  // Check if Deno is the environment
  if (typeof Deno !== "undefined") {
    return Deno.env.get(varName);
  } // Check if Node.js is the environment
  else if (typeof process !== "undefined") {
    return process.env[varName];
  } else {
    throw new Error(
      `Unsupported environment. Error trying to read environment variable: ${varName}.`,
    );
  }
}

const libsqlImportReplacePlugin: (isDenoDeploy: boolean) => esbuild.Plugin = (
  isDenoDeploy,
) => {
  return {
    name: "libsql-import-replace",
    setup(build: esbuild.PluginBuild) {
      const filter = /^@libsql\/client/;

      // Check if should use "web" version of libsql client
      const isWebEnvironment = readEnvVar("DENO_DEPLOY") === "true" ||
        isDenoDeploy;

      // Replace libsql client import with the Deno compatible version
      // https://github.com/tursodatabase/libsql-client-ts/issues/138
      build.onResolve({ filter }, () => {
        return {
          path: isWebEnvironment
            ? "npm:@libsql/client/web"
            : "npm:@libsql/client/node",
          external: true,
        };
      });
    },
  };
};

const replaceProcessCwdPlugin = {
  name: "replace-process-cwd",
  setup(build: esbuild.PluginBuild) {
    build.onLoad({ filter: /\.(ts|js)$/ }, async (args) => {
      const contents = await fs.promises.readFile(args.path, "utf8");

      // Replace process.cwd() with Deno.cwd()
      const newContents = contents.replace(
        /\bprocess\.cwd\s*\(\s*\)/g,
        "Deno.cwd()",
      );

      return {
        contents: newContents,
        loader: args.path.endsWith(".ts") ? "ts" : "js",
      };
    });
  },
};

const denoRenameNodeModulesPlugin = {
  name: "@astrojs/esbuild-rename-node-modules",
  setup(build: esbuild.PluginBuild) {
    const filter = new RegExp(
      COMPATIBLE_NODE_MODULES.map((mod) => `(^${mod}$)`).join("|"),
    );
    build.onResolve(
      { filter },
      (args) => ({ path: "node:" + args.path, external: true }),
    );
  },
};

export default function createIntegration(opts?: Options): AstroIntegration {
  let _buildConfig: BuildConfig;
  let _vite: any;
  return {
    name: "@astrojs/deno",
    hooks: {
      "astro:config:done": ({ setAdapter, config }) => {
        setAdapter(getAdapter(opts));
        _buildConfig = config.build;

        if (config.output === "static") {
          console.warn(
            `[@astrojs/deno] \`output: "server"\` or \`output: "hybrid"\` is required to use this adapter.`,
          );
          console.warn(
            `[@astrojs/deno] Otherwise, this adapter is not required to deploy a static site to Deno.`,
          );
        }
      },
      "astro:build:setup": ({ vite, target }) => {
        if (target === "server") {
          _vite = vite;
          vite.resolve = vite.resolve ?? {};
          vite.resolve.alias = vite.resolve.alias ?? {};
          vite.build = vite.build ?? {};
          vite.build.rollupOptions = vite.build.rollupOptions ?? {};
          vite.build.rollupOptions.external =
            vite.build.rollupOptions.external ?? [];

          const aliases = [{
            find: "react-dom/server",
            replacement: "react-dom/server.browser",
          }];

          if (Array.isArray(vite.resolve.alias)) {
            vite.resolve.alias = [...vite.resolve.alias, ...aliases];
          } else {
            for (const alias of aliases) {
              (vite.resolve.alias as Record<string, string>)[alias.find] =
                alias.replacement;
            }
          }

          if (Array.isArray(vite.build.rollupOptions.external)) {
            vite.build.rollupOptions.external.push(DENO_IMPORTS_SHIM);
          } else if (typeof vite.build.rollupOptions.external !== "function") {
            vite.build.rollupOptions.external = [
              vite.build.rollupOptions.external,
              DENO_IMPORTS_SHIM,
            ];
          }
        }
      },
      "astro:build:done": async () => {
        const entryUrl = new URL(_buildConfig.serverEntry, _buildConfig.server);
        const pth = fileURLToPath(entryUrl);

        const isDenoDeploy = opts?.isDenoDeploy ?? false;

        await esbuild.build({
          target: "esnext",
          platform: "browser",
          entryPoints: [pth],
          outfile: pth,
          allowOverwrite: true,
          format: "esm",
          bundle: true,
          external: [
            ...COMPATIBLE_NODE_MODULES.map((mod) => `node:${mod}`),
            "@astrojs/markdown-remark",
          ],
          plugins: [
            denoImportsShimPlugin,
            denoRenameNodeModulesPlugin,
            replaceProcessCwdPlugin,
            libsqlImportReplacePlugin(isDenoDeploy),
          ],
          banner: {
            js: SHIM,
          },
          logOverride: {
            "ignored-bare-import": "silent",
          },
        });

        // Remove chunks, if they exist. Since we have bundled via esbuild these chunks are trash.
        try {
          const chunkFileNames =
            _vite?.build?.rollupOptions?.output?.chunkFileNames ??
              `chunks/chunk.[hash].mjs`;
          const chunkPath = npath.dirname(chunkFileNames);
          const chunksDirUrl = new URL(chunkPath + "/", _buildConfig.server);
          await fs.promises.rm(chunksDirUrl, { recursive: true, force: true });
        } catch {}
      },
    },
  };
}
