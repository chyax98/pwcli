import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { diffSnapshots } from "../../src/engine/snapshot-diff.js";

describe("diffSnapshots", () => {
  it("detects added refs", () => {
    const before = '- link "Home" [ref=e0]';
    const after = '- link "Home" [ref=e0]\n- button "New" [ref=e1]';
    const result = diffSnapshots(before, after);
    assert.deepEqual(result.added, ["e1"]);
    assert.deepEqual(result.changed, []);
    assert.deepEqual(result.removed, []);
    assert.ok(result.diffText.includes("[+]"));
  });

  it("detects changed refs via child content", () => {
    const before = '- textbox [ref=e0]:\n  - text: "old"';
    const after = '- textbox [ref=e0]:\n  - text: "new"';
    const result = diffSnapshots(before, after);
    assert.deepEqual(result.added, []);
    assert.ok(result.changed.includes("e0"));
    assert.deepEqual(result.removed, []);
    assert.ok(result.diffText.includes("[~]"));
  });

  it("detects removed refs", () => {
    const before = '- link "Home" [ref=e0]\n- button "Delete" [ref=e1]';
    const after = '- link "Home" [ref=e0]';
    const result = diffSnapshots(before, after);
    assert.deepEqual(result.added, []);
    assert.deepEqual(result.changed, []);
    assert.deepEqual(result.removed, ["e1"]);
    assert.ok(result.diffText.includes("# removed: e1"));
  });

  it("returns empty diff for identical snapshots", () => {
    const yaml = '- link "Home" [ref=e0]\n- button "Submit" [ref=e1]';
    const result = diffSnapshots(yaml, yaml);
    assert.deepEqual(result.added, []);
    assert.deepEqual(result.changed, []);
    assert.deepEqual(result.removed, []);
    assert.ok(result.diffText.includes("+0 ~0 -0"));
  });

  it("handles multiple changes at once", () => {
    const before = [
      '- link "Home" [ref=e0]',
      "- textbox [ref=e1]:",
      '  - text: "old"',
      '- button "Delete" [ref=e2]',
    ].join("\n");
    const after = [
      '- link "Home" [ref=e0]',
      "- textbox [ref=e1]:",
      '  - text: "new"',
      '- button "Save" [ref=e3]',
    ].join("\n");
    const result = diffSnapshots(before, after);
    assert.deepEqual(result.added, ["e3"]);
    assert.deepEqual(result.changed, ["e1"]);
    assert.deepEqual(result.removed, ["e2"]);
  });

  it("handles iframe refs", () => {
    const before = '- button "Old" [ref=f1e0]';
    const after = '- button "New" [ref=f1e0]';
    const result = diffSnapshots(before, after);
    assert.deepEqual(result.changed, ["f1e0"]);
  });
});
