import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startFixtureServer } from "../fixtures/server.mjs";
import { runSuite } from "../runners/suite/run-suite.mjs";
import { generateMatrix } from "./generate-matrix.mjs";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const defaultGeneratedDir = resolve(repoRoot, "benchmark", "tasks", "generated");
const defaultReportsDir = resolve(repoRoot, "benchmark", "reports", "nightly");
const defaultArtifactsDir = resolve(repoRoot, "benchmark", "artifacts", "nightly");
const defaultTemplatePath = resolve(
  repoRoot,
  "benchmark",
  "reports",
  "templates",
  "nightly-summary.md",
);

function parseArgs(argv) {
  const parsed = {
    generatedDir: defaultGeneratedDir,
    reportsDir: defaultReportsDir,
    artifactsDir: defaultArtifactsDir,
    workspaceDir: null,
    templatePath: defaultTemplatePath,
    clean: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--generated-dir") {
      parsed.generatedDir = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--reports-dir") {
      parsed.reportsDir = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--artifacts-dir") {
      parsed.artifactsDir = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--workspace-dir") {
      parsed.workspaceDir = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--template") {
      parsed.templatePath = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--no-clean") {
      parsed.clean = false;
    }
  }

  return parsed;
}

export async function runNightlyPack(options = {}) {
  const generatedDir = resolve(options.generatedDir ?? defaultGeneratedDir);
  const reportsDir = resolve(options.reportsDir ?? defaultReportsDir);
  const artifactsDir = resolve(options.artifactsDir ?? defaultArtifactsDir);
  const templatePath = resolve(options.templatePath ?? defaultTemplatePath);
  const workspaceDir =
    options.workspaceDir === undefined || options.workspaceDir === null
      ? await mkdtemp(join(tmpdir(), "pwcli-benchmark-nightly-"))
      : resolve(options.workspaceDir);
  const clean = options.clean !== false;
  const fixture = await startFixtureServer();

  try {
    if (clean) {
      await rm(reportsDir, { recursive: true, force: true });
      await rm(artifactsDir, { recursive: true, force: true });
    }

    const manifest = await generateMatrix({ outputDir: generatedDir });
    const summary = await runSuite({
      tasks: [generatedDir],
      port: String(fixture.port),
      reportsDir,
      artifactsDir,
      workspaceDir,
      surface: {
        kind: "nightly",
        name: "nightly-regression-pack",
      },
      manifest,
      reportTitle: "Nightly Regression Summary",
      summaryTemplatePath: templatePath,
    });

    return {
      manifest,
      port: fixture.port,
      reportsDir: resolve(reportsDir, "latest"),
      artifactsDir,
      summary,
    };
  } finally {
    await fixture.close();
    if (options.workspaceDir === undefined || options.workspaceDir === null) {
      await rm(workspaceDir, { recursive: true, force: true });
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runNightlyPack(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.summary.totals.failed === 0 ? 0 : 1;
}
