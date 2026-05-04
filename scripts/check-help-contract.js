#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const cliPath = resolve(repoRoot, "dist", "cli.js");
const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

function stripAnsi(value) {
  return value.replace(ansiPattern, "");
}

function runPw(args) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolveResult({ code, stdout, stderr, text: stripAnsi(stdout) });
    });
  });
}

async function expectHelp(args, keywords) {
  const result = await runPw([...args, "--help"]);
  assert.equal(result.code, 0, `${args.join(" ")} --help failed: ${result.stderr}`);
  for (const keyword of keywords) {
    assert.ok(
      result.text.includes(keyword),
      `${args.join(" ")} --help missing ${keyword}:\n${result.text}`,
    );
  }
}

await expectHelp(
  ["auth", "dc"],
  ["Purpose:", "Options:", "Examples:", "Notes:", "targetUrl", "phone", "smsCode", "baseURL"],
);

await expectHelp(
  ["batch"],
  ["Purpose:", "Options:", "Examples:", "Notes:", "string[][]", "--stdin-json"],
);

await expectHelp(
  ["code"],
  ["Purpose:", "Options:", "Examples:", "Notes:", "escape hatch", "--file"],
);

await expectHelp(
  ["diagnostics", "bundle"],
  ["Purpose:", "Options:", "Examples:", "Notes:", "handoff", "manifest.json", "handoff.md"],
);

await expectHelp(
  ["har", "start"],
  ["Purpose:", "Options:", "Examples:", "Notes:", "unsupported", "replay"],
);

await expectHelp(["har", "stop"], ["unsupported", "replay"]);

await expectHelp(
  ["session", "create"],
  ["Purpose:", "Examples:", "named session", "--open", "--state"],
);

await expectHelp(
  ["route", "add"],
  ["Purpose:", "Examples:", "fulfill", "abort", "matcher", "patch"],
);

await expectHelp(
  ["environment", "geolocation", "set"],
  ["Purpose:", "Examples:", "--lat", "--lng", "permissions"],
);

await expectHelp(
  ["verify"],
  ["Purpose:", "Examples:", "assertion", "VERIFY_FAILED", "text-absent"],
);

await expectHelp(
  ["wait"],
  ["Purpose:", "Examples:", "network-idle", "selector", "request", "response"],
);

const authInfo = await runPw(["auth", "info", "dc", "--output", "json"]);
assert.equal(authInfo.code, 0, `auth info dc failed: ${authInfo.stderr}`);
const authInfoJson = JSON.parse(authInfo.stdout);
assert.equal(authInfoJson.data?.source, undefined, "auth info must omit source by default");
assert.ok(Array.isArray(authInfoJson.data?.args), "auth info must expose provider args");
assert.ok(Array.isArray(authInfoJson.data?.examples), "auth info must expose provider examples");

const authInfoVerbose = await runPw(["auth", "info", "dc", "--verbose", "--output", "json"]);
assert.equal(authInfoVerbose.code, 0, `auth info dc --verbose failed: ${authInfoVerbose.stderr}`);
const authInfoVerboseJson = JSON.parse(authInfoVerbose.stdout);
assert.equal(
  typeof authInfoVerboseJson.data?.source,
  "string",
  "auth info --verbose must expose source",
);
