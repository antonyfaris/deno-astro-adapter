/**
 * Read environment variable with compatibility for Deno and Node
 */
export function readEnvVar(varName: string) {
  // Declare global process object for Deno compatibility

  // Check if Deno is the environment
  if (typeof Deno !== "undefined") return Deno.env.get(varName);
  // Check if Node.js is the environment
  if (typeof process !== "undefined") return process.env[varName];
  // Throw error if environment is not supported
  throw new Error(
    `Unsupported environment. Error trying to read environment variable: ${varName}.`,
  );
}
