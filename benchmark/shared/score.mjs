import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const defaultSummaryTemplatePath = resolve(
  repoRoot,
  "benchmark",
  "reports",
  "templates",
  "nightly-summary.md",
);

export const BENCHMARK_SCORE_CONTRACT_VERSION = 1;

function round(value) {
  return Math.round(value * 100) / 100;
}

function normalizeSurface(surface = {}) {
  const kind = typeof surface.kind === "string" && surface.kind.length > 0 ? surface.kind : "suite";
  const name = typeof surface.name === "string" && surface.name.length > 0 ? surface.name : kind;
  return { kind, name };
}

function summarizeTotals(tasks) {
  const total = tasks.length;
  const passed = tasks.filter((task) => task.status === "passed").length;
  return {
    total,
    passed,
    failed: total - passed,
  };
}

function summarizeFailureFamilies(tasks) {
  const failureFamilies = {};
  for (const task of tasks) {
    if (!task.failureFamily) {
      continue;
    }
    failureFamilies[task.failureFamily] = (failureFamilies[task.failureFamily] ?? 0) + 1;
  }
  return failureFamilies;
}

function summarizeCategories(tasks) {
  const categories = {};
  for (const task of tasks) {
    const key = task.category || "unknown";
    const bucket = categories[key] || { total: 0, passed: 0, failed: 0 };
    bucket.total += 1;
    if (task.status === "passed") {
      bucket.passed += 1;
    } else {
      bucket.failed += 1;
    }
    categories[key] = bucket;
  }

  return Object.fromEntries(
    Object.entries(categories)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [
        key,
        {
          ...value,
          passRate: value.total > 0 ? round((value.passed / value.total) * 100) : 0,
        },
      ]),
  );
}

function replaceTemplateTokens(template, replacements) {
  return template.replace(/\{\{([a-zA-Z0-9]+)\}\}/g, (_, token) => replacements[token] ?? "");
}

function renderMatrixSummary(manifest) {
  if (!manifest || typeof manifest !== "object") {
    return "- not attached";
  }
  const lines = [];
  if (typeof manifest.total === "number") {
    lines.push(`- Total tasks: ${manifest.total}`);
  }
  const families =
    manifest.families && typeof manifest.families === "object"
      ? Object.entries(manifest.families).sort(([left], [right]) => left.localeCompare(right))
      : [];
  if (families.length === 0) {
    lines.push("- Families: none");
    return lines.join("\n");
  }
  lines.push(...families.map(([family, count]) => `- ${family}: ${count}`));
  return lines.join("\n");
}

function renderCategoryRows(categories) {
  const entries = Object.entries(categories);
  if (entries.length === 0) {
    return "| - | 0 | 0 | 0 | 0% |";
  }
  return entries
    .map(
      ([category, value]) =>
        `| ${category} | ${value.total} | ${value.passed} | ${value.failed} | ${value.passRate}% |`,
    )
    .join("\n");
}

function renderFailureFamilies(failureFamilies) {
  const entries = Object.entries(failureFamilies);
  if (entries.length === 0) {
    return "- none";
  }
  return entries.map(([family, count]) => `- ${family}: ${count}`).join("\n");
}

function renderTaskRows(tasks) {
  if (tasks.length === 0) {
    return "| - | - | - | - |";
  }
  return tasks
    .map((task) => `| ${task.id} | ${task.category ?? "unknown"} | ${task.status} | ${task.failureFamily ?? "-"} |`)
    .join("\n");
}

export function createBenchmarkSummary(tasks, options = {}) {
  return {
    contractVersion: BENCHMARK_SCORE_CONTRACT_VERSION,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    surface: normalizeSurface(options.surface),
    manifest: options.manifest ?? null,
    totals: summarizeTotals(tasks),
    failureFamilies: summarizeFailureFamilies(tasks),
    tasks,
  };
}

export function computeBenchmarkScore(tasks, options = {}) {
  const totals = summarizeTotals(tasks);
  const passRate = totals.total > 0 ? round((totals.passed / totals.total) * 100) : 0;

  return {
    contractVersion: BENCHMARK_SCORE_CONTRACT_VERSION,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    surface: normalizeSurface(options.surface),
    totals,
    total: totals.total,
    passed: totals.passed,
    failed: totals.failed,
    passRate,
    categories: summarizeCategories(tasks),
    failureFamilies: summarizeFailureFamilies(tasks),
    overallScore: passRate,
    verdict: totals.failed === 0 ? "pass" : "fail",
  };
}

export async function renderBenchmarkReport(summary, options = {}) {
  const score =
    options.score ??
    computeBenchmarkScore(summary.tasks, {
      generatedAt: summary.generatedAt,
      surface: summary.surface,
    });
  const reportTitle =
    typeof options.reportTitle === "string" && options.reportTitle.length > 0
      ? options.reportTitle
      : "Benchmark Summary";
  const templatePath =
    typeof options.templatePath === "string" && options.templatePath.length > 0
      ? resolve(options.templatePath)
      : defaultSummaryTemplatePath;
  const template = await readFile(templatePath, "utf8");

  return replaceTemplateTokens(template, {
    reportTitle,
    surfaceKind: score.surface.kind,
    surfaceName: score.surface.name,
    generatedAt: summary.generatedAt,
    verdict: score.verdict,
    overallScore: String(score.overallScore),
    passRate: String(score.passRate),
    total: String(score.total),
    passed: String(score.passed),
    failed: String(score.failed),
    matrixSummary: renderMatrixSummary(summary.manifest),
    categoryRows: renderCategoryRows(score.categories),
    failureFamilies: renderFailureFamilies(summary.failureFamilies),
    taskRows: renderTaskRows(summary.tasks),
  });
}
