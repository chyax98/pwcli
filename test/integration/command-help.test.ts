import assert from "node:assert/strict";
import { createWorkspace, removeWorkspace, runPw } from "./_helpers.ts";

const workspaceDir = await createWorkspace("pwcli-command-help-");

try {
  const runHelp = async (args: string[]) => await runPw([...args, "--help"], { cwd: workspaceDir });

  const accessibility = await runHelp(["accessibility"]);
  assert.equal(accessibility.code, 0, `accessibility --help failed: ${accessibility.stderr}`);
  assert.ok(
    accessibility.stdout.includes("--interactive-only"),
    `accessibility --help missing --interactive-only: ${accessibility.stdout}`,
  );
  assert.ok(
    accessibility.stdout.includes("--root"),
    `accessibility --help missing --root: ${accessibility.stdout}`,
  );

  const mouse = await runHelp(["mouse"]);
  assert.equal(mouse.code, 0, `mouse --help failed: ${mouse.stderr}`);
  assert.ok(mouse.stdout.includes("move"), `mouse --help missing move: ${mouse.stdout}`);
  assert.ok(mouse.stdout.includes("click"), `mouse --help missing click: ${mouse.stdout}`);
  assert.ok(mouse.stdout.includes("wheel"), `mouse --help missing wheel: ${mouse.stdout}`);
  assert.ok(mouse.stdout.includes("drag"), `mouse --help missing drag: ${mouse.stdout}`);

  const video = await runHelp(["video"]);
  assert.equal(video.code, 0, `video --help failed: ${video.stderr}`);
  assert.ok(video.stdout.includes("start"), `video --help missing start: ${video.stdout}`);
  assert.ok(video.stdout.includes("stop"), `video --help missing stop: ${video.stdout}`);

  const har = await runHelp(["har"]);
  assert.equal(har.code, 0, `har --help failed: ${har.stderr}`);
  assert.ok(har.stdout.includes("replay"), `har --help missing replay: ${har.stdout}`);

  const network = await runHelp(["network"]);
  assert.equal(network.code, 0, `network --help failed: ${network.stderr}`);
  assert.ok(
    network.stdout.includes("--include-body"),
    `network --help missing --include-body: ${network.stdout}`,
  );

  const diagnosticsShow = await runHelp(["diagnostics", "show"]);
  assert.equal(
    diagnosticsShow.code,
    0,
    `diagnostics show --help failed: ${diagnosticsShow.stderr}`,
  );
  assert.ok(
    diagnosticsShow.stdout.includes("--run=<id>"),
    `diagnostics show --help missing --run: ${diagnosticsShow.stdout}`,
  );

  const diagnosticsGrep = await runHelp(["diagnostics", "grep"]);
  assert.equal(
    diagnosticsGrep.code,
    0,
    `diagnostics grep --help failed: ${diagnosticsGrep.stderr}`,
  );
  assert.ok(
    diagnosticsGrep.stdout.includes("--run=<id>"),
    `diagnostics grep --help missing --run: ${diagnosticsGrep.stdout}`,
  );

  const locate = await runHelp(["locate"]);
  assert.equal(locate.code, 0, `locate --help failed: ${locate.stderr}`);
  assert.ok(
    locate.stdout.includes("--return-ref"),
    `locate --help missing --return-ref: ${locate.stdout}`,
  );

  const stateDiff = await runHelp(["state", "diff"]);
  assert.equal(stateDiff.code, 0, `state diff --help failed: ${stateDiff.stderr}`);
  assert.ok(
    stateDiff.stdout.includes("--include-values"),
    `state diff --help missing --include-values: ${stateDiff.stdout}`,
  );

  // batch --help does not list supported commands, so verify via a failed batch run that exposes
  // the supportedTopLevel list in the error envelope.
  const batch = await runHelp(["batch"]);
  assert.equal(batch.code, 0, `batch --help failed: ${batch.stderr}`);

  const batchRun = await runPw(
    ["batch", "--session", "ghost", "--stdin-json", "--output", "json"],
    { cwd: workspaceDir, input: '[["fill","--selector","#x","val"]]' },
  );

  const batchEnvelope = batchRun.json as {
    ok: false;
    error: {
      details: {
        analysis: { supportedTopLevel: string[] };
      };
    };
  };
  assert.ok(batchEnvelope && !batchEnvelope.ok, "expected batch to fail");
  const supportedTopLevel = batchEnvelope.error.details.analysis.supportedTopLevel;
  assert.ok(
    supportedTopLevel.includes("fill"),
    `supportedTopLevel missing fill: ${supportedTopLevel.join(", ")}`,
  );
  assert.ok(
    supportedTopLevel.includes("check"),
    `supportedTopLevel missing check: ${supportedTopLevel.join(", ")}`,
  );
  assert.ok(
    supportedTopLevel.includes("select"),
    `supportedTopLevel missing select: ${supportedTopLevel.join(", ")}`,
  );
} finally {
  await removeWorkspace(workspaceDir);
}
