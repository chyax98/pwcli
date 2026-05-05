#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../..");
const resultsPath = resolve(repoRoot, "test/contract/product-surface-evaluation-results.md");
const localBin = (name) => resolve(repoRoot, "node_modules/.bin", name);

const surfaces = {
  A: {
    title: "Session Lifecycle",
    commands: ["session", "open", "status", "observe"],
    checks: [
      ["tsx", "--test", "test/integration/session.test.ts"],
      ["tsx", "--test", "test/integration/session-startup-lock-race.test.ts"],
      ["tsx", "--test", "test/integration/session-attachable-id.test.ts"],
      ["node", "dist/cli.js", "session", "--help"],
      ["node", "dist/cli.js", "open", "--help"],
      ["node", "dist/cli.js", "status", "--help"],
      ["node", "dist/cli.js", "observe", "--help"],
    ],
  },
  B: {
    title: "Page Reading and Workspace Facts",
    commands: [
      "read-text",
      "text",
      "snapshot",
      "accessibility",
      "page",
      "tab",
      "screenshot",
      "pdf",
    ],
    checks: [
      ["tsx", "--test", "test/integration/page-reading.test.ts"],
      ["tsx", "--test", "test/integration/accessibility.test.ts"],
      ["tsx", "--test", "test/integration/page-assess.test.ts"],
      ["tsx", "--test", "test/integration/popup.test.ts"],
      ["node", "test/contract/check-content-boundaries-contract.js"],
    ],
  },
  C: {
    title: "Element and Page Actions",
    commands: [
      "click",
      "fill",
      "type",
      "press",
      "hover",
      "check",
      "uncheck",
      "select",
      "drag",
      "upload",
      "download",
      "scroll",
      "resize",
      "mouse",
      "dialog",
    ],
    checks: [
      ["tsx", "--test", "test/integration/interaction.test.ts"],
      ["tsx", "--test", "test/integration/mouse.test.ts"],
      ["tsx", "--test", "test/integration/popup.test.ts"],
      ["tsx", "--test", "test/integration/control-state.test.ts"],
      ["tsx", "--test", "test/integration/action-policy.test.ts"],
      ["tsx", "--test", "test/integration/error-messages.test.ts"],
      ["node", "test/contract/check-doctor-modal-contract.js"],
      ["node", "test/contract/check-recovery-envelope-contract.js"],
    ],
  },
  D: {
    title: "State Checks, Waits, and Assertions",
    commands: ["locate", "get", "is", "verify", "wait"],
    checks: [
      ["tsx", "--test", "test/integration/state-checks.test.ts"],
      ["tsx", "--test", "test/integration/verify-failure-run.test.ts"],
      ["tsx", "--test", "test/integration/error-messages.test.ts"],
      ["node", "test/contract/check-batch-verify-contract.js"],
      ["node", "test/contract/check-recovery-envelope-contract.js"],
    ],
  },
  E: {
    title: "Diagnostics and Evidence",
    commands: [
      "console",
      "network",
      "errors",
      "diagnostics",
      "trace",
      "har",
      "sse",
      "doctor",
      "screenshot",
      "pdf",
    ],
    checks: [
      ["tsx", "--test", "test/integration/diagnostics.test.ts"],
      ["tsx", "--test", "test/integration/network-body.test.ts"],
      ["tsx", "--test", "test/integration/sse-observation.test.ts"],
      ["tsx", "--test", "test/integration/har.test.ts"],
      ["tsx", "--test", "test/integration/video.test.ts"],
      ["tsx", "--test", "test/unit/diagnostics-run-digest.test.ts"],
      ["tsx", "--test", "test/unit/diagnostics-signal-scoring.test.ts"],
      ["node", "test/contract/check-trace-inspect-contract.js"],
      ["node", "test/contract/check-har-contract.js"],
      ["node", "test/contract/check-doctor-modal-contract.js"],
    ],
  },
  F: {
    title: "Environment, Bootstrap, Route, and State Mutation",
    commands: ["environment", "bootstrap", "route", "state", "storage", "cookies"],
    checks: [
      ["tsx", "--test", "test/integration/bootstrap-persistence.test.ts"],
      ["tsx", "--test", "test/integration/route-query-header-match.test.ts"],
      ["tsx", "--test", "test/integration/allowed-domains.test.ts"],
      ["tsx", "--test", "test/integration/storage-cookies.test.ts"],
      ["tsx", "--test", "test/integration/storage-indexeddb-export.test.ts"],
      ["tsx", "--test", "test/integration/state-diff.test.ts"],
      ["node", "test/contract/check-environment-geolocation-contract.js"],
    ],
  },
  G: {
    title: "Auth and Reusable Profiles",
    commands: ["auth", "profile", "state"],
    checks: [
      ["tsx", "--test", "test/integration/auth-probe.test.ts"],
      ["tsx", "--test", "test/integration/profile-auth.test.ts"],
      ["tsx", "--test", "test/integration/profile-state.test.ts"],
      ["tsx", "--test", "test/integration/profile-capability-probe.test.ts"],
    ],
  },
  H: {
    title: "Agent Shortcuts and Structured Extraction",
    commands: ["find-best", "act", "analyze-form", "fill-form", "extract", "check-injection"],
    checks: [
      ["tsx", "--test", "test/integration/intent-actions.test.ts"],
      ["tsx", "--test", "test/integration/form-analysis.test.ts"],
      ["tsx", "--test", "test/integration/extract.test.ts"],
      ["tsx", "--test", "test/integration/check-injection.test.ts"],
      ["node", "test/contract/check-help-contract.js"],
    ],
  },
  I: {
    title: "Batch and Escape Hatch",
    commands: ["batch", "code"],
    checks: [
      ["tsx", "--test", "test/integration/batch.test.ts"],
      ["tsx", "--test", "test/integration/action-policy.test.ts"],
      ["node", "test/contract/check-batch-allowlist-contract.js"],
      ["node", "test/contract/check-batch-verify-contract.js"],
      ["node", "test/contract/check-run-code-timeout-recovery.js"],
    ],
  },
  J: {
    title: "Preview, Human Control, and Handoff",
    commands: ["stream", "view", "control-state", "takeover", "release-control", "dashboard"],
    checks: [
      ["tsx", "--test", "test/integration/stream-preview.test.ts"],
      ["tsx", "--test", "test/integration/view-open.test.ts"],
      ["tsx", "--test", "test/integration/control-state.test.ts"],
      ["node", "test/contract/check-dashboard-contract.js"],
      ["tsx", "--test", "test/integration/diagnostics.test.ts"],
    ],
  },
  K: {
    title: "Skill, Help, and Release Contract",
    commands: ["skill", "doctor", "all --help"],
    checks: [
      ["node", "test/contract/check-help-contract.js"],
      ["node", "test/contract/check-skill-contract.js"],
      ["node", "test/contract/check-skill-show-contract.js"],
      ["node", "test/contract/check-skill-install-contract.js"],
      ["node", "dist/cli.js", "--help"],
      ["pnpm", "pack:check"],
    ],
  },
};

function shellLine(args) {
  return args.map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(" ");
}

function run(args) {
  return new Promise((resolveResult) => {
    const startedAt = Date.now();
    const command =
      args[0] === "node"
        ? [process.execPath, ...args.slice(1)]
        : args[0] === "tsx"
          ? [localBin("tsx"), ...args.slice(1)]
          : args;
    const child = spawn(command[0], command.slice(1), {
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
    child.on("close", (code) => {
      resolveResult({
        args,
        code,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr,
      });
    });
    child.on("error", (error) => {
      resolveResult({
        args,
        code: 1,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr: error.message,
      });
    });
  });
}

function truncate(text) {
  const clean = text.trim();
  if (!clean) return "";
  const lines = clean.split("\n").slice(-12);
  return lines.join("\n").slice(-2000);
}

function defaultManualSection() {
  return [
    "Manual score:",
    "",
    "| Dimension | Score | Evidence |",
    "|---|---:|---|",
    "| Product Fit |  |  |",
    "| Journey Completeness |  |  |",
    "| Contract Stability |  |  |",
    "| Evidence & Recovery |  |  |",
    "| Test Realism |  |  |",
    "| Boundary Hygiene |  |  |",
    "| Total |  |  |",
    "",
    "Verdict:",
    "",
    "- [ ] Healthy",
    "- [ ] Needs test",
    "- [ ] Needs fix",
    "- [ ] Needs docs",
    "- [ ] Should be downgraded",
    "- [ ] Should be removed",
    "",
    "Findings:",
    "",
    "- None recorded yet.",
  ].join("\n");
}

function manualSectionFrom(section) {
  const marker = "\nManual score:\n";
  const index = section.indexOf(marker);
  if (index === -1) return undefined;
  const manual = section.slice(index + 1);
  const endIndex = manual.indexOf("\n<!-- surface:");
  return (endIndex === -1 ? manual : manual.slice(0, endIndex)).trimEnd();
}

function sectionFor(surface, result, manualSection = defaultManualSection()) {
  const passed = result.checks.every((check) => check.code === 0);
  const lines = [
    `<!-- surface:${result.key}:start -->`,
    `## Surface ${result.key}: ${surface.title}`,
    "",
    `Status: ${passed ? "AUTOMATED_EVIDENCE_PASSED" : "AUTOMATED_EVIDENCE_FAILED"}`,
    "",
    `Evaluated at: ${result.evaluatedAt}`,
    "",
    `Commands: ${surface.commands.map((command) => `\`${command}\``).join(", ")}`,
    "",
    "| Check | Exit | Duration | Evidence |",
    "|---|---:|---:|---|",
    ...result.checks.map((check) => {
      const evidence =
        check.code === 0
          ? "passed"
          : `failed: ${truncate(check.stderr || check.stdout).replace(/\n/g, "<br>")}`;
      return `| \`${shellLine(check.args)}\` | ${check.code} | ${check.durationMs}ms | ${evidence} |`;
    }),
    "",
    manualSection,
    "",
    `<!-- surface:${result.key}:end -->`,
  ];
  return lines.join("\n");
}

function writeResult(surface, result) {
  const header = [
    "# pwcli Product Surface Evaluation Results",
    "",
    "This file records executed product-surface evaluations.",
    "",
    "Do not treat this file as user documentation.",
    "",
  ].join("\n");
  const start = `<!-- surface:${result.key}:start -->`;
  const end = `<!-- surface:${result.key}:end -->`;
  const current = existsSync(resultsPath) ? readFileSync(resultsPath, "utf8") : header;
  const startIndex = current.indexOf(start);
  const endIndex = current.indexOf(end);
  const previousSection =
    startIndex !== -1 && endIndex !== -1 ? current.slice(startIndex, endIndex + end.length) : "";
  const nextSection = sectionFor(surface, result, manualSectionFrom(previousSection));
  if (startIndex !== -1 && endIndex !== -1) {
    const before = current.slice(0, startIndex).trimEnd();
    const after = current.slice(endIndex + end.length).trimStart();
    writeFileSync(resultsPath, `${before}\n\n${nextSection}\n\n${after}`.trimEnd() + "\n", "utf8");
    return;
  }
  writeFileSync(resultsPath, `${current.trimEnd()}\n\n${nextSection}\n`, "utf8");
}

async function main() {
  const key = process.argv[2]?.toUpperCase();
  if (!key || !surfaces[key]) {
    console.error(
      `Usage: node test/contract/evaluate-product-surface.js <${Object.keys(surfaces).join("|")}>`,
    );
    process.exit(2);
  }
  const surface = surfaces[key];
  const checks = [];
  for (const args of surface.checks) {
    process.stdout.write(`[surface ${key}] ${shellLine(args)}\n`);
    const result = await run(args);
    checks.push(result);
    process.stdout.write(`[surface ${key}] exit=${result.code} duration=${result.durationMs}ms\n`);
    if (result.code !== 0) {
      process.stdout.write(`${truncate(result.stderr || result.stdout)}\n`);
    }
  }
  const result = {
    key,
    evaluatedAt: new Date().toISOString(),
    checks,
  };
  writeResult(surface, result);
  const failed = checks.filter((check) => check.code !== 0);
  if (failed.length > 0) {
    console.error(
      `surface ${key} failed ${failed.length} check(s); results written to ${resultsPath}`,
    );
    process.exit(1);
  }
  process.stdout.write(`surface ${key} passed; results written to ${resultsPath}\n`);
}

await main();
