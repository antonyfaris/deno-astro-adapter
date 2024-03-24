import { fromFileUrl } from 'https://deno.land/std@0.110.0/path/mod.ts';
import { assert } from 'https://deno.land/std@0.158.0/testing/asserts.ts';
import { readableStreamFromReader } from 'https://deno.land/std@0.142.0/streams/conversion.ts';

const dir = new URL('./', import.meta.url);
const defaultURL = new URL('http://localhost:8085/');

export const defaultTestPermissions: Deno.PermissionOptions = {
	read: true,
	net: true,
	run: true,
	env: true,
};

declare type ExitCallback = () => void;

function createCommand(
  args: string[],
  options?: Deno.CommandOptions
): Deno.Command {
  if (Deno.build.os === "windows") {
    return new Deno.Command("cmd.exe", {
      args: ["/c", ...args],
      ...options,
    });
  } else {
    return new Deno.Command("sh", {
      args: ["-c", args.join(" ")],
      ...options,
    });
  }
}

export async function runBuild(fixturePath: string) {
  createCommand;
  const command = createCommand(["pnpm", "astro", "build", "--silent"], {
    cwd: fromFileUrl(new URL(fixturePath, dir)),
  });
  const { success } = await command.output();
  assert(success, "Build failed");
}

export async function startModFromImport(baseUrl: URL): Promise<ExitCallback> {
	const entryUrl = new URL('./dist/server/entry.mjs', baseUrl);
	const mod = await import(entryUrl.toString());

	if (!mod.running()) {
		mod.start();
	}

	return () => mod.stop();
}

export async function runBuildAndStartApp(fixturePath: string) {
	const url = new URL(fixturePath, dir);

	await runBuild(fixturePath);
	const stop = await startModFromImport(url);

	return { url: defaultURL, stop };
}
