#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const coreChecks = [
  "check-batch-allowlist-contract.js",
  "check-help-contract.js",
  "check-recovery-envelope-contract.js",
  "check-skill-contract.js",
  "check-skill-install-contract.js",
  "check-skill-show-contract.js",
];

const allChecks = [
  ...coreChecks,
  "check-batch-verify-contract.js",
  "check-trace-inspect-contract.js",
  "check-doctor-modal-contract.js",
  "check-run-code-timeout-recovery.js",
  "check-har-contract.js",
  "check-environment-geolocation-contract.js",
];

const mode = process.argv[2] ?? "core";
const checks = mode === "all" ? allChecks : coreChecks;

for (const check of checks) {
  const result = spawnSync(process.execPath, [`test/contract/${check}`], { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
