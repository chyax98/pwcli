import { assertIncludes, assertOk, parseJson, runPwSync } from "./_helpers.js";

const session = "envgeo";

runPwSync(["session", "close", session]);

const help = runPwSync(["environment", "geolocation", "set", "--help"]);
assertOk(help, "environment geolocation set --help");
assertIncludes(help.stdout, "--lat", "help");
assertIncludes(help.stdout, "--lng", "help");

try {
  assertOk(
    runPwSync(["session", "create", session, "--no-headed", "--open", "about:blank"]),
    "session create",
  );

  const setResult = runPwSync([
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

  const positionalResult = runPwSync([
    "environment",
    "geolocation",
    "set",
    "-s",
    session,
    "40.7128",
    "--",
    "-74.006",
  ]);
  if (positionalResult.status === 0) {
    throw new Error("environment geolocation set positional form unexpectedly succeeded");
  }
  assertIncludes(
    `${positionalResult.stdout}\n${positionalResult.stderr}`,
    "requires --lat <lat> --lng <lng>",
    "positional rejection",
  );
} finally {
  runPwSync(["session", "close", session]);
}
