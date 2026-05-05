#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const coreTests = [
  "test/integration/session.test.ts",
  "test/integration/batch.test.ts",
  "test/integration/auth-probe.test.ts",
  "test/integration/fixture-app.test.ts",
  "test/integration/profile-capability-probe.test.ts",
];

for (const file of coreTests) {
  const result = spawnSync("tsx", ["--test", file], { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
