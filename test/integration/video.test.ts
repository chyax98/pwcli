import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { after, describe, it } from "node:test";
import { runPw, uniqueSessionName } from "./_helpers.ts";

const makeSessionName = () => uniqueSessionName("it-video-");

describe("video", { concurrency: false }, () => {
  const sessionsToClean: string[] = [];

  after(async () => {
    for (const name of sessionsToClean) {
      try {
        await runPw(["session", "close", name, "--output", "json"]);
      } catch {
        // ignore
      }
    }
  });

  it("records video through the session lifecycle", async () => {
    const name = makeSessionName();
    sessionsToClean.push(name);
    const tmpDir = mkdtempSync(resolve(tmpdir(), "pwcli-video-"));
    const videoDir = resolve(tmpDir, "videos");

    try {
      const createResult = await runPw([
        "session",
        "create",
        name,
        "--record-video",
        videoDir,
        "--record-video-size",
        "640x360",
        "--open",
        "about:blank",
        "--output",
        "json",
      ]);
      assert.equal(createResult.code, 0, `session create failed: ${createResult.stderr}`);
      const createJson = createResult.json as {
        ok: boolean;
        data: { recordVideo?: { dir?: string; size?: { width?: number; height?: number } } };
      };
      assert.equal(createJson.ok, true);
      assert.equal(createJson.data.recordVideo?.dir, videoDir);
      assert.equal(createJson.data.recordVideo?.size?.width, 640);
      assert.equal(createJson.data.recordVideo?.size?.height, 360);

      await runPw(["open", "https://example.com", "--session", name, "--output", "json"]);

      const closeResult = await runPw(["session", "close", name, "--output", "json"]);
      assert.equal(closeResult.code, 0, `session close failed: ${closeResult.stderr}`);

      assert.ok(existsSync(videoDir), `video dir should exist at ${videoDir}`);
      const videos = readdirSync(videoDir).filter((entry) => entry.endsWith(".webm"));
      assert.ok(videos.length > 0, "at least one webm video should be written");
      assert.ok(
        videos.some((entry) => statSync(resolve(videoDir, entry)).size > 0),
        "at least one webm video should be non-empty",
      );
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
