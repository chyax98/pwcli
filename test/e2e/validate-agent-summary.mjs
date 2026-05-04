import { readFileSync } from "node:fs";

const [summaryPath] = process.argv.slice(2);

const summary = JSON.parse(readFileSync(summaryPath, "utf8"));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(summary && typeof summary === "object", "summary must be an object");
assert(summary.status === "passed" || summary.status === "failed", "invalid status");
assert(typeof summary.task === "string" && summary.task.length > 0, "missing task");
assert(typeof summary.skillPath === "string" && summary.skillPath.length > 0, "missing skillPath");
assert(Number.isInteger(summary.stepCount) && summary.stepCount >= 1, "invalid stepCount");
assert(Array.isArray(summary.steps) && summary.steps.length >= 1, "missing steps");
assert(Array.isArray(summary.evidence), "missing evidence");
assert("tokenUsage" in summary, "missing tokenUsage");
assert(typeof summary.tokenUsage === "number" || summary.tokenUsage === null, "invalid tokenUsage");
