import assert from "node:assert/strict";
import { createWorkspace, removeWorkspace, runPw, uniqueSessionName } from "./_helpers.ts";

const workspaceDir = await createWorkspace("pwcli-stream-preview-");
const sessionName = uniqueSessionName("stream");

try {
  const create = await runPw(
    [
      "session",
      "create",
      sessionName,
      "--headless",
      "--open",
      "https://example.com",
      "--output",
      "json",
    ],
    { cwd: workspaceDir },
  );
  assert.equal(create.code, 0, `session create failed: ${create.stderr}`);

  const start = await runPw(["stream", "start", "--session", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.equal(start.code, 0, `stream start failed: ${start.stderr}`);
  const startPayload = start.json as {
    ok: boolean;
    data: { url: string; port: number; started: boolean };
  };
  assert.equal(startPayload.ok, true);
  assert.equal(startPayload.data.started, true);
  assert.ok(startPayload.data.port > 0);

  const status = await runPw(["stream", "status", "--session", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.equal(status.code, 0, `stream status failed: ${status.stderr}`);
  const statusPayload = status.json as {
    ok: boolean;
    data: { url: string; healthy: boolean };
  };
  assert.equal(statusPayload.ok, true);
  assert.equal(statusPayload.data.healthy, true);

  const observe = await runPw(["observe", "status", "--session", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.equal(observe.code, 0, `observe status failed: ${observe.stderr}`);
  const observePayload = observe.json as {
    ok: boolean;
    data: { stream?: { supported?: boolean; active?: boolean; healthy?: boolean; url?: string } };
  };
  assert.equal(observePayload.ok, true);
  assert.equal(observePayload.data.stream?.supported, true);
  assert.equal(observePayload.data.stream?.active, true);
  assert.equal(observePayload.data.stream?.healthy, true);
  assert.equal(observePayload.data.stream?.url, startPayload.data.url);

  const screenshot = await runPw(
    [
      "screenshot",
      "--session",
      sessionName,
      "--path",
      `${workspaceDir}/preview.png`,
      "--output",
      "json",
    ],
    { cwd: workspaceDir },
  );
  assert.equal(screenshot.code, 0, `screenshot failed: ${screenshot.stderr}`);

  const statusResponse = await fetch(new URL("/status.json", startPayload.data.url));
  assert.equal(statusResponse.status, 200);
  const statusJson = (await statusResponse.json()) as {
    recentEvents?: Array<{ command?: string }>;
  };
  assert.ok(Array.isArray(statusJson.recentEvents));
  assert.ok(statusJson.recentEvents?.some((item) => item.command === "screenshot"));
  const frameResponse = await fetch(new URL("/frame.jpg", startPayload.data.url));
  assert.equal(frameResponse.status, 200);
  assert.equal(frameResponse.headers.get("content-type"), "image/jpeg");
  const frameBytes = new Uint8Array(await frameResponse.arrayBuffer());
  assert.ok(frameBytes.length > 1000, "frame should contain image bytes");

  const stop = await runPw(["stream", "stop", "--session", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  });
  assert.equal(stop.code, 0, `stream stop failed: ${stop.stderr}`);
} finally {
  await runPw(["stream", "stop", "--session", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  }).catch(() => undefined);
  await runPw(["session", "close", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  }).catch(() => undefined);
  await removeWorkspace(workspaceDir);
}
