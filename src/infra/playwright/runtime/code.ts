import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runManagedSessionCommand } from "../cli-client.js";
import {
  parseErrorText,
  parseJsonStringLiteral,
  parsePageSummary,
  parseResultText,
  parseSnapshotYaml,
} from "../output-parsers.js";
import { isModalStateBlockedMessage, maybeRawOutput } from "./shared.js";

export async function managedSnapshot(options?: {
  depth?: number;
  sessionName?: string;
  interactive?: boolean;
  compact?: boolean;
}) {
  const args = ["snapshot"];
  if (options?.depth) {
    args.push(`--depth=${options.depth}`);
  }
  const result = await runManagedSessionCommand(
    {
      _: args,
    },
    {
      sessionName: options?.sessionName,
    },
  );
  const snapshot = parseSnapshotYaml(result.text);
  const projectedSnapshot = projectSnapshot(snapshot, {
    interactive: Boolean(options?.interactive),
    compact: Boolean(options?.compact),
  });
  return {
    session: {
      scope: "managed",
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page: parsePageSummary(result.text),
    data: {
      mode: options?.interactive ? "interactive" : options?.compact ? "compact" : "ai",
      snapshot: projectedSnapshot,
      ...(options?.interactive || options?.compact
        ? {
          totalCharCount: snapshot.length,
            charCount: projectedSnapshot.length,
            truncated: projectedSnapshot.length !== snapshot.length,
          }
        : {}),
      ...maybeRawOutput(result.text),
    },
  };
}

function projectSnapshot(
  snapshot: string,
  options: {
    interactive: boolean;
    compact: boolean;
  },
) {
  const lines = options.interactive ? interactiveSnapshotLines(snapshot) : snapshot.split("\n");
  const projected = options.compact ? compactSnapshotLines(lines) : lines;
  return projected.join("\n").trim();
}

function interactiveSnapshotLines(snapshot: string) {
  const interactivePattern =
    /\b(button|link|textbox|combobox|checkbox|radio|menuitem|tab|switch|slider|spinbutton|searchbox|option)\b|aria-ref=|ref=/i;
  return snapshot
    .split("\n")
    .filter((line) => interactivePattern.test(line));
}

function compactSnapshotLines(lines: string[]) {
  return lines.filter((line) => !/^\s*-\s+generic(?:\s+\[ref=[^\]]+\])?:?\s*$/.test(line));
}

export async function managedRunCode(options: {
  source?: string;
  file?: string;
  sessionName?: string;
}) {
  const args = ["run-code"];
  let source = options.source;
  let filename: string | undefined;
  if (options.file) {
    filename = resolve(options.file);
    source = await readFile(filename, "utf8");
  }
  if (source) {
    args.push(source);
  }
  const result = await runManagedSessionCommand(
    {
      _: args,
      ...(filename ? { filename } : {}),
    },
    {
      sessionName: options.sessionName,
    },
  );
  const errorText = parseErrorText(result.text);
  if (errorText) {
    throw new Error(isModalStateBlockedMessage(errorText) ? "MODAL_STATE_BLOCKED" : errorText);
  }
  const resultText = parseResultText(result.text);
  return {
    session: {
      scope: "managed",
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page: parsePageSummary(result.text),
    rawText: result.text,
    data: {
      resultText,
      result: parseJsonStringLiteral(resultText),
      ...maybeRawOutput(result.text),
    },
  };
}
