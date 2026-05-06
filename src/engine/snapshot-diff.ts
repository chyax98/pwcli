import { loadSnapshotCache, managedSnapshot } from "./observe.js";

export interface SnapshotDiffResult {
  added: string[];
  changed: string[];
  removed: string[];
  diffText: string;
}

/**
 * Parse ARIA YAML into ref → content map.
 * Content includes the ref's own line (without [ref=...]) and child lines
 * (until the next ref or top-level line).
 */
function parseRefNodes(yaml: string): Map<string, string> {
  const lines = yaml.split("\n");
  const result = new Map<string, string>();
  let currentRef: string | null = null;
  let currentContent: string[] = [];
  let currentIndent = 0;

  for (const line of lines) {
    const refMatch = line.match(/\[ref=((?:f[0-9]+)?e[0-9]+)\]/);
    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;

    if (refMatch) {
      if (currentRef) {
        result.set(currentRef, currentContent.join("\n"));
      }
      currentRef = refMatch[1];
      currentIndent = indent;
      currentContent = [line.replace(/\[ref=[^\]]+\]/, "").trim()];
    } else if (currentRef && indent > currentIndent) {
      currentContent.push(line.trim());
    } else {
      if (currentRef) {
        result.set(currentRef, currentContent.join("\n"));
        currentRef = null;
        currentContent = [];
      }
    }
  }

  if (currentRef) {
    result.set(currentRef, currentContent.join("\n"));
  }

  return result;
}

export function diffSnapshots(beforeYaml: string, afterYaml: string): SnapshotDiffResult {
  const beforeMap = parseRefNodes(beforeYaml);
  const afterMap = parseRefNodes(afterYaml);

  const added: string[] = [];
  const changed: string[] = [];
  const removed: string[] = [];

  for (const [ref, afterContent] of afterMap) {
    const beforeContent = beforeMap.get(ref);
    if (!beforeContent) added.push(ref);
    else if (beforeContent !== afterContent) changed.push(ref);
  }
  for (const ref of beforeMap.keys()) {
    if (!afterMap.has(ref)) removed.push(ref);
  }

  const addedSet = new Set(added);
  const changedSet = new Set(changed);
  const diffLines: string[] = [];
  diffLines.push(`# snap-diff: +${added.length} ~${changed.length} -${removed.length}`);

  for (const line of afterYaml.split("\n")) {
    const refMatch = line.match(/\[ref=((?:f[0-9]+)?e[0-9]+)\]/);
    if (refMatch) {
      const ref = refMatch[1];
      if (addedSet.has(ref)) diffLines.push(line + " [+]");
      else if (changedSet.has(ref)) diffLines.push(line + " [~]");
      else diffLines.push(line);
    } else {
      diffLines.push(line);
    }
  }

  if (removed.length > 0) {
    diffLines.push(`# removed: ${removed.join(", ")}`);
  }

  return { added, changed, removed, diffText: diffLines.join("\n").trim() };
}

/**
 * Load cached snapshot, take a fresh snapshot, and diff.
 * Called after an action completes when --snap-diff is set.
 */
export async function computePostActionDiff(
  sessionName?: string,
): Promise<SnapshotDiffResult | null> {
  const cache = await loadSnapshotCache(sessionName);
  if (!cache?.yaml) return null;

  const after = await managedSnapshot({
    sessionName,
    interactive: cache.interactive,
    compact: cache.compact,
  });

  const afterYaml = typeof after.data.snapshot === "string" ? after.data.snapshot : "";
  if (!afterYaml) return null;

  return diffSnapshots(cache.yaml, afterYaml);
}
