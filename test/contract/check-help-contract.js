#!/usr/bin/env node

import assert from "node:assert/strict";
import { runPw } from "./_helpers.js";

const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

function stripAnsi(value) {
  return value.replace(ansiPattern, "");
}

async function expectHelp(args, keywords) {
  const result = await runPw([...args, "--help"]);
  result.text = stripAnsi(result.stdout);
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
  ["session", "create"],
  ["Purpose:", "Examples:", "named session", "--open", "--state", "--record-har", "--record-video"],
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
  ["find-best"],
  ["Purpose:", "Options:", "Examples:", "intent", "submit_form", "accept_cookies"],
);

await expectHelp(
  ["act"],
  ["Purpose:", "Options:", "Examples:", "submit_form", "accept_cookies", "wait/verify"],
);

await expectHelp(
  ["analyze-form"],
  ["Purpose:", "Options:", "Examples:", "field metadata", "#login-form"],
);

await expectHelp(
  ["fill-form"],
  ["Purpose:", "Options:", "Examples:", "JSON object", "--file", "Password"],
);

await expectHelp(
  ["extract"],
  ["Purpose:", "Options:", "Examples:", "selector-based schema", ".card", "fields"],
);

await expectHelp(
  ["check-injection"],
  ["Purpose:", "Options:", "Examples:", "--include-hidden", "heuristic", "high-severity"],
);

await expectHelp(
  ["profile", "save-state"],
  ["Save current session storage state", "named local profile", "--session"],
);

await expectHelp(
  ["profile", "list-state"],
  ["List named local state profiles", "Output format: text|json"],
);

await expectHelp(
  ["profile", "save-auth"],
  ["Save an encrypted named auth profile", "--url", "--values", "--file"],
);

await expectHelp(
  ["profile", "login-auth"],
  ["Load a saved auth profile", "submit_form", "session"],
);

await expectHelp(
  ["profile", "list-auth"],
  ["List encrypted named auth profiles", "Output format: text|json"],
);

await expectHelp(["stream"], ["start", "status", "stop", "preview stream server"]);

await expectHelp(["view"], ["open", "status", "close", "preview workbench"]);

await expectHelp(
  ["control-state"],
  ["Show whether a session is under CLI or human control", "--session"],
);

await expectHelp(["takeover"], ["Mark a session as human-controlled", "--actor", "--reason"]);

await expectHelp(["release-control"], ["Return a session to CLI control", "--session"]);

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
