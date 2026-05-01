import assert from "node:assert/strict";
import { resolve } from "node:path";
import {
  BENCHMARK_SCORE_CONTRACT_VERSION,
  createBenchmarkSummary,
  computeBenchmarkScore,
  renderBenchmarkReport,
} from "../../benchmark/shared/score.mjs";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const templatePath = resolve(repoRoot, "benchmark", "reports", "templates", "nightly-summary.md");
const generatedAt = "2026-05-01T00:00:00.000Z";
const surface = {
  kind: "nightly",
  name: "nightly-regression-pack",
};

const tasks = [
  {
    id: "fixture-perception-00",
    category: "perception",
    status: "passed",
    failureFamily: null,
  },
  {
    id: "fixture-diagnostics-00",
    category: "diagnostics",
    status: "failed",
    failureFamily: "API_5XX",
  },
  {
    id: "fixture-auth-00",
    category: "auth-state",
    status: "failed",
    failureFamily: "AUTH_NOT_REUSED",
  },
];

const summary = createBenchmarkSummary(tasks, {
  generatedAt,
  surface,
  manifest: {
    contractVersion: 1,
    total: 3,
    families: {
      perception: 1,
      diagnostics: 1,
      "auth-state": 1,
    },
  },
});

assert.equal(summary.contractVersion, BENCHMARK_SCORE_CONTRACT_VERSION);
assert.equal(summary.generatedAt, generatedAt);
assert.deepEqual(summary.surface, surface);
assert.deepEqual(summary.totals, {
  total: 3,
  passed: 1,
  failed: 2,
});
assert.deepEqual(summary.failureFamilies, {
  API_5XX: 1,
  AUTH_NOT_REUSED: 1,
});

const score = computeBenchmarkScore(tasks, {
  generatedAt,
  surface,
});

assert.equal(score.contractVersion, BENCHMARK_SCORE_CONTRACT_VERSION);
assert.equal(score.generatedAt, generatedAt);
assert.deepEqual(score.surface, surface);
assert.deepEqual(score.totals, summary.totals);
assert.equal(score.total, 3);
assert.equal(score.passed, 1);
assert.equal(score.failed, 2);
assert.equal(score.passRate, 33.33);
assert.equal(score.overallScore, 33.33);
assert.equal(score.verdict, "fail");
assert.deepEqual(score.failureFamilies, {
  API_5XX: 1,
  AUTH_NOT_REUSED: 1,
});
assert.deepEqual(score.categories, {
  "auth-state": {
    total: 1,
    passed: 0,
    failed: 1,
    passRate: 0,
  },
  diagnostics: {
    total: 1,
    passed: 0,
    failed: 1,
    passRate: 0,
  },
  perception: {
    total: 1,
    passed: 1,
    failed: 0,
    passRate: 100,
  },
});

const report = await renderBenchmarkReport(summary, {
  score,
  reportTitle: "Nightly Regression Summary",
  templatePath,
});

assert.match(report, /^# Nightly Regression Summary/m);
assert.match(report, /Surface: `nightly` \/ `nightly-regression-pack`/);
assert.match(report, /Generated At: `2026-05-01T00:00:00.000Z`/);
assert.match(report, /Verdict: `fail`/);
assert.match(report, /Overall Score: `33.33`/);
assert.match(report, /Pass Rate: `33.33%`/);
assert.match(report, /- perception: 1/);
assert.match(report, /- diagnostics: 1/);
assert.match(report, /- auth-state: 1/);
assert.match(report, /\| perception \| 1 \| 1 \| 0 \| 100% \|/);
assert.match(report, /\| fixture-diagnostics-00 \| diagnostics \| failed \| API_5XX \|/);
assert.match(report, /- API_5XX: 1/);
assert.match(report, /- AUTH_NOT_REUSED: 1/);
