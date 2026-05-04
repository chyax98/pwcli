import { existsSync } from "node:fs";
import { parseJson, runPwSync } from "./_helpers.js";

const session = "tracev";

runPwSync(["session", "close", session]);

try {
  const create = runPwSync([
    "session",
    "create",
    session,
    "--no-headed",
    "--no-trace",
    "--open",
    "data:text/html,<main><button>trace target</button></main>",
  ]);
  if (create.status !== 0) {
    throw new Error(`session create failed\n${create.stdout}\n${create.stderr}`);
  }

  const start = runPwSync(["trace", "start", "--session", session, "--output", "json"]);
  if (start.status !== 0) {
    throw new Error(`trace start failed\n${start.stdout}\n${start.stderr}`);
  }

  const click = runPwSync(["click", "--session", session, "--text", "trace target"]);
  if (click.status !== 0) {
    throw new Error(`trace target click failed\n${click.stdout}\n${click.stderr}`);
  }

  const stop = runPwSync(["trace", "stop", "--session", session, "--output", "json"]);
  if (stop.status !== 0) {
    throw new Error(`trace stop failed\n${stop.stdout}\n${stop.stderr}`);
  }
  const stopPayload = parseJson(stop.stdout, "trace stop");
  const traceArtifactPath = stopPayload.data?.traceArtifactPath;
  if (typeof traceArtifactPath !== "string" || !traceArtifactPath) {
    throw new Error(
      `trace stop did not return traceArtifactPath: ${JSON.stringify(stopPayload, null, 2)}`,
    );
  }
  if (!existsSync(traceArtifactPath)) {
    throw new Error(`trace artifact was not created: ${traceArtifactPath}`);
  }

  const inspect = runPwSync([
    "trace",
    "inspect",
    traceArtifactPath,
    "--section",
    "actions",
    "--limit",
    "5",
    "--output",
    "json",
  ]);
  if (inspect.status !== 0) {
    throw new Error(`trace inspect failed\n${inspect.stdout}\n${inspect.stderr}`);
  }
  const inspectPayload = parseJson(inspect.stdout, "trace inspect");
  if (inspectPayload.ok !== true || inspectPayload.data?.section !== "actions") {
    throw new Error(`unexpected trace inspect payload: ${JSON.stringify(inspectPayload, null, 2)}`);
  }
  if (!String(inspectPayload.data?.output ?? "").includes("Action")) {
    throw new Error(
      `trace inspect output did not include actions table: ${inspectPayload.data?.output ?? ""}`,
    );
  }
} finally {
  runPwSync(["session", "close", session]);
}
