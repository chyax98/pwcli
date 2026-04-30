import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const defaultGeneratedRoot = resolve(repoRoot, "benchmark", "tasks", "generated");

function pad(value) {
  return String(value).padStart(2, "0");
}

async function writeTask(rootDir, relativePath, task) {
  const absolutePath = resolve(rootDir, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(task, null, 2)}\n`, "utf8");
}

function perceptionTask(index) {
  const variant = `perception-${pad(index)}`;
  const title = `Fixture Article ${variant}`;
  const body = `Stable body marker for ${variant}.`;
  const cta = `Primary CTA ${variant}`;
  return {
    id: `fixture-perception-${pad(index)}`,
    title: `Perception fixture ${variant}`,
    category: "perception",
    mode: "fixture",
    site: {
      name: "deterministic-fixture",
      startUrl: `http://127.0.0.1:<port>/article?variant=${variant}&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&cta=${encodeURIComponent(cta)}`,
      requiresLogin: false,
      authMode: "none",
    },
    goal: "Read a deterministic article and verify title, body, and primary CTA.",
    allowedCommands: ["session", "open", "page", "read-text", "locate", "screenshot", "diagnostics"],
    failureTaxonomy: [
      "PERCEPTION_FAILED",
      "TEXT_EXTRACTION_FAILED",
      "LOCATOR_NOT_FOUND",
      "VERIFY_FAILED",
      "ARTIFACT_INVALID",
    ],
    evidenceRequired: ["page current", "read-text excerpt", "locate cta", "screenshot"],
    benchmark: {
      planKind: "perception-article",
      expectations: {
        title,
        body,
        cta,
      },
    },
  };
}

function diagnosticsTask(index) {
  const variant = `diagnostics-${pad(index)}`;
  return {
    id: `fixture-diagnostics-${pad(index)}`,
    title: `Diagnostics fixture ${variant}`,
    category: "diagnostics",
    mode: "fixture",
    site: {
      name: "deterministic-fixture",
      startUrl: `http://127.0.0.1:<port>/api-500?variant=${variant}&status=500`,
      requiresLogin: false,
      authMode: "none",
    },
    goal: "Observe a deterministic API 500 failure and preserve diagnostics evidence.",
    allowedCommands: ["session", "open", "wait", "network", "diagnostics", "screenshot"],
    failureTaxonomy: ["API_5XX", "NETWORK_FAILED", "VERIFY_FAILED", "ARTIFACT_INVALID"],
    evidenceRequired: ["network summary", "diagnostics digest", "screenshot"],
    benchmark: {
      planKind: "diagnostics-api500",
      expectations: {
        status: 500,
        readyText: `API ready ${variant}`,
      },
    },
  };
}

function authTask(index) {
  const variant = `auth-${pad(index)}`;
  const authenticated = index % 2 === 0;
  const marker = `${variant}-token`;
  return {
    id: `fixture-auth-${pad(index)}`,
    title: `Auth fixture ${variant}`,
    category: "auth-state",
    mode: "fixture",
    site: {
      name: "deterministic-fixture",
      startUrl: `http://127.0.0.1:<port>/auth?variant=${variant}&mode=${authenticated ? "authenticated" : "anonymous"}&marker=${marker}`,
      requiresLogin: false,
      authMode: "none",
    },
    goal: "Probe deterministic authenticated or anonymous fixture state.",
    allowedCommands: ["session", "open", "auth", "page", "read-text"],
    failureTaxonomy: ["AUTH_NOT_REUSED", "VERIFY_FAILED", "ARTIFACT_INVALID"],
    evidenceRequired: ["auth probe", "page current"],
    benchmark: {
      planKind: "auth-state",
      expectations: {
        status: authenticated ? "authenticated" : "anonymous",
        marker,
        heading: authenticated ? `Welcome ${variant}` : `Login required ${variant}`,
      },
    },
  };
}

function extractionTask(index) {
  const variant = `extract-${pad(index)}`;
  const count = 3 + (index % 3);
  const mode = index % 2 === 0 ? "dom" : "runtime";
  const recipePath = `benchmark/fixtures/recipes/${mode === "dom" ? "dom-card-list.json" : "runtime-card-list.json"}`;
  return {
    id: `fixture-extract-${pad(index)}`,
    title: `Extraction fixture ${variant}`,
    category: "extraction",
    mode: "fixture",
    site: {
      name: "deterministic-fixture",
      startUrl: `http://127.0.0.1:<port>/extract-list?variant=${variant}&count=${count}&mode=${mode}`,
      requiresLogin: false,
      authMode: "none",
    },
    goal: "Extract deterministic card records into a structured artifact.",
    allowedCommands: ["session", "open", "extract"],
    failureTaxonomy: ["EXTRACTION_INCOMPLETE", "SCRIPT_INJECTION_FAILED", "VERIFY_FAILED"],
    evidenceRequired: ["extract artifact"],
    benchmark: {
      planKind: "extraction-list",
      recipePath,
      expectations: {
        count,
        firstTitle: `${variant} title 1`,
        mode,
      },
    },
  };
}

export async function generateMatrix(options = {}) {
  const generatedRoot = resolve(options.outputDir ?? defaultGeneratedRoot);
  await rm(generatedRoot, { recursive: true, force: true });
  const tasks = [];

  for (let index = 0; index < 96; index += 1) {
    const task = perceptionTask(index);
    tasks.push(task);
    await writeTask(generatedRoot, `perception/${task.id}.json`, task);
  }

  for (let index = 0; index < 96; index += 1) {
    const task = diagnosticsTask(index);
    tasks.push(task);
    await writeTask(generatedRoot, `diagnostics/${task.id}.json`, task);
  }

  for (let index = 0; index < 96; index += 1) {
    const task = authTask(index);
    tasks.push(task);
    await writeTask(generatedRoot, `auth-state/${task.id}.json`, task);
  }

  for (let index = 0; index < 32; index += 1) {
    const task = extractionTask(index);
    tasks.push(task);
    await writeTask(generatedRoot, `extraction/${task.id}.json`, task);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    total: tasks.length,
    families: {
      perception: 96,
      diagnostics: 96,
      "auth-state": 96,
      extraction: 32,
    },
  };
  await writeFile(resolve(generatedRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return {
    ...manifest,
    outputDir: generatedRoot,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const manifest = await generateMatrix();
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}
