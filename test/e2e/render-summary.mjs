import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [stepLogPath, warningsPath, outputPath, sessionName, reuseSessionName] =
  process.argv.slice(2);

const steps = existsSync(stepLogPath)
  ? readFileSync(stepLogPath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  : [];

const warnings = existsSync(warningsPath)
  ? readFileSync(warningsPath, "utf8").split("\n").filter(Boolean)
  : [];

const commandKinds = [...new Set(steps.map((step) => step.command[0]))];

const summary = {
  schemaVersion: "1.0",
  task: "dogfood incident reproduce and diagnostics flow",
  skillPath: resolve("skills/pwcli/SKILL.md"),
  sessions: [sessionName, reuseSessionName],
  totals: {
    stepCount: steps.length,
    uniqueCommandKinds: commandKinds.length,
    warningCount: warnings.length,
  },
  commandKinds,
  steps,
  tokenUsage: {
    available: false,
    value: null,
    reason: "e2e shell runner does not execute an LLM directly",
  },
};

writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
