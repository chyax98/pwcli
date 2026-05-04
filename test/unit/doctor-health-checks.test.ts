import assert from "node:assert/strict";
import { inspectEnvironment } from "../../src/store/health.js";

const diagnostic = await inspectEnvironment();
const nodeVersion = diagnostic.details?.nodeVersion as
  | { ok: boolean; version: string; minimum: string }
  | undefined;
assert.ok(nodeVersion, "inspectEnvironment should include nodeVersion details");
const result = nodeVersion;
assert.ok("ok" in result, "result should have ok property");
assert.ok("version" in result, "result should have version property");
assert.ok("minimum" in result, "result should have minimum property");
assert.equal(typeof result.ok, "boolean", "ok should be boolean");
assert.equal(typeof result.version, "string", "version should be string");
assert.equal(typeof result.minimum, "string", "minimum should be string");
assert.ok(result.version.startsWith("v"), `version should start with 'v': ${result.version}`);
assert.equal(result.ok, true, "current Node should satisfy minimum >= 18");

console.log("doctor-health-checks tests passed");
