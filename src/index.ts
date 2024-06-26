import { fileURLToPath } from "node:url";

import esbuild from "esbuild";

import { COMPATIBLE_NODE_MODULES } from "./consts.ts";
import { readEnvVar } from "./utils.ts";

import type { AstroAdapter, AstroConfig, AstroIntegration } from "astro";
import type { Options } from "./types.ts";

const SHIM = `globalThis.process = {
  argv: [],
  env: Deno.env.toObject(),
  cwd: Deno.cwd,
};`;

export function getAdapter(opts?: Options): AstroAdapter {
  return {
    name: "@antonyfaris/deno-astro-adapter",
    serverEntrypoint: "@antonyfaris/deno-astro-adapter/server.ts",
    args: opts ?? {},
    exports: ["stop", "handle", "start", "running"],
    supportedAstroFeatures: {
      hybridOutput: "stable",
      staticOutput: "stable",
      serverOutput: "stable",
      assets: {
        supportKind: "stable",
        isSharpCompatible: true,
        isSquooshCompatible: false,
      },
    },
  };
}

const libsqlImportReplacePlugin: (isDenoDeploy: boolean) => esbuild.Plugin = (
  isDenoDeploy,
) => {
  return {
    name: "libsql-import-replace",
    setup(build: esbuild.PluginBuild) {
      const filter = /^@libsql\/client/;

      // Check if the "web" version of the libsql client should be used.
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
  let _buildConfig: AstroConfig["build"];
  return {
    name: "@antonyfaris/deno-astro-adapter",
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
            "sharp",
          ],
          plugins: [
            denoRenameNodeModulesPlugin,
            libsqlImportReplacePlugin(isDenoDeploy),
          ],
          banner: {
            js: SHIM,
          },
          logOverride: {
            "ignored-bare-import": "silent",
          },
        });
      },
    },
  };
}
