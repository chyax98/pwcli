import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { generateMatrix } from "../benchmark/scripts/generate-matrix.mjs";

const tempRoot = await mkdtemp(join(tmpdir(), "pwcli-benchmark-matrix-"));
const generatedRoot = resolve(tempRoot, "generated");

function countJsonFiles(entries) {
  return entries.filter((entry) => entry.endsWith(".json")).length;
}

try {
  const manifest = await generateMatrix({ outputDir: generatedRoot });
  assert.equal(manifest.total, 288);
  assert.deepEqual(manifest.families, {
    perception: 96,
    diagnostics: 96,
    "auth-state": 96,
  });

  const manifestFile = JSON.parse(
    await readFile(resolve(generatedRoot, "manifest.json"), "utf8"),
  ) as {
    total: number;
  };
  assert.equal(manifestFile.total, 288);

  const perceptionFiles = await readdir(resolve(generatedRoot, "perception"));
  const diagnosticsFiles = await readdir(resolve(generatedRoot, "diagnostics"));
  const authFiles = await readdir(resolve(generatedRoot, "auth-state"));

  assert.equal(countJsonFiles(perceptionFiles), 96);
  assert.equal(countJsonFiles(diagnosticsFiles), 96);
  assert.equal(countJsonFiles(authFiles), 96);

  await stat(resolve(generatedRoot, "perception", "fixture-perception-00.json"));
  await stat(resolve(generatedRoot, "diagnostics", "fixture-diagnostics-00.json"));
  await stat(resolve(generatedRoot, "auth-state", "fixture-auth-00.json"));
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
