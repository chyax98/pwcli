#!/usr/bin/env node

import assert from "node:assert/strict";
import commands from "../../dist/cli/commands/index.js";
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

async function loadCommand(value) {
  return typeof value === "function" ? await value() : value;
}

async function commandPaths(prefix, registry) {
  const paths = [];
  for (const [name, value] of Object.entries(registry)) {
    const command = await loadCommand(value);
    const path = [...prefix, name];
    paths.push(path);
    if (command?.subCommands) {
      paths.push(...(await commandPaths(path, command.subCommands)));
    }
  }
  return paths;
}

for (const path of await commandPaths([], commands)) {
  await expectHelp(path, ["Purpose:", "Examples:"]);
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

for (const path of [
  ["session", "list"],
  ["session", "attach"],
  ["session", "recreate"],
  ["session", "status"],
  ["session", "close"],
  ["diagnostics", "export"],
  ["diagnostics", "runs"],
  ["diagnostics", "digest"],
  ["diagnostics", "show"],
  ["diagnostics", "timeline"],
  ["profile", "save-state"],
  ["profile", "load-state"],
  ["profile", "list-state"],
  ["profile", "remove-state"],
  ["profile", "save-auth"],
  ["profile", "login-auth"],
  ["profile", "list-auth"],
  ["profile", "remove-auth"],
]) {
  await expectHelp(path, ["Purpose:", "Examples:", "Notes:"]);
}

for (const command of [
  "cookies",
  "dashboard",
  "dialog",
  "environment",
  "mouse",
  "page",
  "profile",
  "skill",
  "stream",
  "tab",
  "trace",
  "view",
  "bootstrap",
  "control-state",
  "doctor",
  "download",
  "drag",
  "pdf",
  "release-control",
  "resize",
  "sse",
  "state",
  "storage",
  "takeover",
  "upload",
  "open",
  "status",
  "read-text",
  "snapshot",
  "accessibility",
  "click",
  "fill",
  "type",
  "press",
  "check",
  "uncheck",
  "select",
  "hover",
  "scroll",
  "screenshot",
  "network",
  "console",
  "errors",
  "locate",
  "get",
  "is",
]) {
  await expectHelp([command], ["Purpose:", "Examples:", "Notes:"]);
}

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

await expectHelp(["stream"], ["Purpose:", "Examples:", "Notes:", "start", "status", "stop"]);

await expectHelp(["view"], ["Purpose:", "Examples:", "Notes:", "open", "status", "close"]);

await expectHelp(["control-state"], ["Purpose:", "Examples:", "Notes:", "--session"]);

await expectHelp(["takeover"], ["Purpose:", "Examples:", "Notes:", "--actor", "--reason"]);

await expectHelp(["release-control"], ["Purpose:", "Examples:", "Notes:", "--session"]);

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
