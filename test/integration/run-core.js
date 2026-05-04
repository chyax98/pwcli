#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const coreTests = [
  "test/integration/command-help.test.ts",
  "test/integration/batch-allowlist.test.ts",
  "test/integration/fixture-app.test.ts",
  "test/integration/diagnostics-failure-run.test.ts",
  "test/integration/profile-capability-probe.test.ts",
];

const result = spawnSync("tsx", ["--test", ...coreTests], { stdio: "inherit", shell: true });
process.exit(result.status ?? 1);
