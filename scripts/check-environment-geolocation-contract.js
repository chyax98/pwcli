import { spawnSync } from "node:child_process";

const cli = ["node", "dist/cli.js"];
const session = "envgeo";

function run(args, options = {}) {
  const result = spawnSync(cli[0], [...cli.slice(1), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    ...options,
  });
  return result;
}

function assertOk(result, label) {
  if (result.status !== 0) {
    throw new Error(
      `${label} failed with status ${result.status}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
  }
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label} did not include ${expected}\n${text}`);
  }
}

function parseJson(stdout, label) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`${label} did not return JSON: ${error.message}\n${stdout}`);
  }
}

run(["session", "close", session]);

const help = run(["environment", "geolocation", "set", "--help"]);
assertOk(help, "environment geolocation set --help");
assertIncludes(help.stdout, "--lat", "help");
assertIncludes(help.stdout, "--lng", "help");

try {
  assertOk(
    run(["session", "create", session, "--no-headed", "--open", "about:blank"]),
    "session create",
  );

  const setResult = run([
    "environment",
    "geolocation",
    "set",
    "-s",
    session,
    "--lat",
    "37.7749",
    "--lng",
    "-122.4194",
    "--output",
    "json",
  ]);
  assertOk(setResult, "environment geolocation set --lat --lng");

  const payload = parseJson(setResult.stdout, "environment geolocation set");
  const geolocation = payload?.data?.geolocation;
  if (geolocation?.latitude !== 37.7749 || geolocation?.longitude !== -122.4194) {
    throw new Error(`unexpected geolocation payload: ${JSON.stringify(payload, null, 2)}`);
  }

  const positionalResult = run([
    "environment",
    "geolocation",
    "set",
    "-s",
    session,
    "--output",
    "json",
    "40.7128",
    "--",
    "-74.006",
  ]);
  assertOk(positionalResult, "environment geolocation set positional fallback");

  const positionalPayload = parseJson(positionalResult.stdout, "environment geolocation set positional");
  const positionalGeolocation = positionalPayload?.data?.geolocation;
  if (positionalGeolocation?.latitude !== 40.7128 || positionalGeolocation?.longitude !== -74.006) {
    throw new Error(`unexpected positional payload: ${JSON.stringify(positionalPayload, null, 2)}`);
  }
} finally {
  run(["session", "close", session]);
}
