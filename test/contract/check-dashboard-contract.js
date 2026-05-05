#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.execPath,
  ["dist/cli.js", "dashboard", "open", "--dry-run", "--output", "json"],
  {
    encoding: "utf8",
  },
);

assert.equal(result.status, 0, `dashboard dry-run failed\n${result.stdout}\n${result.stderr}`);
const payload = JSON.parse(result.stdout);
assert.equal(payload.ok, true);
assert.equal(payload.command, "dashboard open");
assert.equal(payload.data.launched, false);
assert.equal(payload.data.available, true);
assert.equal(typeof payload.data.entrypoint, "string");
assert.equal(typeof payload.data.dashboardApp, "string");
