import { fromFileUrl } from "std/path/mod.ts";
import { assert } from "std/assert/assert.ts";

const dir = new URL("./", import.meta.url);
const defaultURL = new URL("http://localhost:8085/");

export const defaultTestPermissions: Deno.PermissionOptions = {
  read: true,
  net: true,
  run: true,
  env: true,
  ffi: true,
  sys: true,
};

type ExitCallback = () => void;
type ExitCallbackPromise = () => Promise<void>;

export async function runBuild(fixturePath: string) {
  const astroExec = Deno.build.os === "windows" ? "astro.CMD" : "astro";
  const command = new Deno.Command(`./node_modules/.bin/${astroExec}`, {
    args: [
      "build",
      "--silent",
    ],
    cwd: fromFileUrl(new URL(fixturePath, dir)),
  });

  const { success } = await command.output();
  assert(success, "Build failed");
}

export async function startModFromImport(baseUrl: URL): Promise<ExitCallback> {
  const entryUrl = new URL("./dist/server/entry.mjs", baseUrl);
  const mod = await import(entryUrl.toString());

  if (!mod.running()) {
    mod.start();
  }

  return () => mod.stop();
}

export async function startModFromSubprocess(
  baseUrl: URL,
): Promise<ExitCallbackPromise> {
  const entryUrl = new URL("./dist/server/entry.mjs", baseUrl);

  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-env",
      "--allow-net",
      "--allow-ffi",
      fromFileUrl(entryUrl),
    ],
    cwd: fromFileUrl(baseUrl),
    stdout: "piped",
  });

  const proc = command.spawn();

  const dec = new TextDecoder();
  for await (const bytes of proc.stdout) {
    const msg = dec.decode(bytes);
    if (msg.includes("Listening on")) {
      break;
    }
  }

  return async () => {
    proc.kill();
    await proc.status;
  };
}

export async function runBuildAndStartApp(fixturePath: string) {
  const url = new URL(fixturePath, dir);

  await runBuild(fixturePath);
  const stop = await startModFromImport(url);

  return { url: defaultURL, stop };
}

export async function runBuildAndStartAppFromSubprocess(fixturePath: string) {
  const url = new URL(fixturePath, dir);

  await runBuild(fixturePath);
  const stop = await startModFromSubprocess(url);

  return { url: defaultURL, stop };
}
