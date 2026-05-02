import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runManagedSessionCommand } from "../cli-client.js";

/** Default timeout for managedRunCode calls.
 *  Protects against Playwright-core's waitForCompletion hanging
 *  on network/navigation waits. 25s gives waitForCompletion's 10s load
 *  timeout + 500ms fixed wait + overhead room. */
const DEFAULT_RUN_CODE_TIMEOUT_MS = 25_000;

import {
  parseErrorText,
  parseJsonStringLiteral,
  parsePageSummary,
  parseResultText,
  parseSnapshotYaml,
} from "../output-parsers.js";
import { isModalStateBlockedMessage, maybeRawOutput } from "./shared.js";
import { pageIdRuntimePrelude } from "./workspace.js";

function extractSnapshotRefs(snapshot: string) {
  // Match both main frame refs (e1, e2) and iframe refs (f1e1, f2e3)
  return [...snapshot.matchAll(/\[ref=((?:f[0-9]+)?e[0-9]+)\]/g)].map((match) => match[1]);
}

async function recordSnapshotRefEpoch(options: { sessionName?: string; snapshot: string }) {
  const refs = extractSnapshotRefs(options.snapshot);
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      ${pageIdRuntimePrelude()}

      state.nextSnapshotSeq = Number.isInteger(state.nextSnapshotSeq) ? state.nextSnapshotSeq : 1;

      for (const current of context.pages()) {
        ensurePageId(current);
        ensureNavigationId(current);
      }

      const snapshotId = 'snap-' + state.nextSnapshotSeq++;
      const epoch = {
        snapshotId,
        pageId: ensurePageId(page),
        navigationId: ensureNavigationId(page),
        url: page.url(),
        capturedAt: new Date().toISOString(),
        refs: ${JSON.stringify(refs)},
      };
      state.lastSnapshotRefEpoch = epoch;
      return JSON.stringify(epoch);
    }`,
  });
  return result.data.result;
}

export async function managedSnapshot(options?: {
  depth?: number;
  sessionName?: string;
  interactive?: boolean;
  compact?: boolean;
  skipEpoch?: boolean;
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
  if (!options?.skipEpoch) {
    await recordSnapshotRefEpoch({
      sessionName: options?.sessionName,
      snapshot: projectedSnapshot,
    });
  }
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
  return snapshot.split("\n").filter((line) => interactivePattern.test(line));
}

function compactSnapshotLines(lines: string[]) {
  return lines.filter((line) => !/^\s*-\s+generic(?:\s+\[ref=[^\]]+\])?:?\s*$/.test(line));
}

export async function managedRunCode(options: {
  source?: string;
  file?: string;
  sessionName?: string;
  retry?: number;
  /** Timeout in ms for the daemon command. Protects against waitForCompletion
   *  hanging on network/navigation waits in Playwright-core. */
  timeoutMs?: number;
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
  const attempts = Math.max(1, Math.floor(Number(options.retry ?? 0)) + 1);
  let result: Awaited<ReturnType<typeof runManagedSessionCommand>> | undefined;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      result = await runManagedSessionCommand(
        {
          _: args,
          ...(filename ? { filename } : {}),
        },
        {
          sessionName: options.sessionName,
          timeoutMs: options.timeoutMs ?? DEFAULT_RUN_CODE_TIMEOUT_MS,
          timeoutMessage: `Code execution exceeded the ${(options.timeoutMs ?? DEFAULT_RUN_CODE_TIMEOUT_MS) / 1000}s guard timeout. Split long flows into first-class pw commands + explicit pw wait steps.`,
          timeoutCode: "RUN_CODE_TIMEOUT",
        },
      );
      const errorText = parseErrorText(result.text);
      if (errorText) {
        throw new Error(enrichRunCodeError(errorText));
      }
      break;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) {
        throw error;
      }
    }
  }
  if (!result) {
    throw lastError instanceof Error
      ? lastError
      : new Error(String(lastError ?? "run-code failed"));
  }
  const errorText = parseErrorText(result.text);
  if (errorText) {
    throw new Error(enrichRunCodeError(errorText));
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

function enrichRunCodeError(errorText: string) {
  if (isModalStateBlockedMessage(errorText)) {
    return "MODAL_STATE_BLOCKED";
  }
  const hints: string[] = [];
  if (/not visible|element is not visible/i.test(errorText)) {
    hints.push(
      "PWCLI_HINT: element exists but is not visible; check hidden submenu, closed dropdown, CSS display/visibility, offscreen position, or covered overlay.",
    );
  }
  if (/Timeout \d+ms exceeded|timed out/i.test(errorText)) {
    hints.push(
      "PWCLI_HINT: operation timed out; verify selector uniqueness, wait for the trigger state, or use `pw snapshot -i` / screenshot before retrying.",
    );
  }
  if (/strict mode violation/i.test(errorText)) {
    hints.push(
      "PWCLI_HINT: locator matched multiple elements; add --nth, a narrower selector, or role/name constraints.",
    );
  }
  if (/intercepts pointer events|element.*covered|receives pointer events/i.test(errorText)) {
    hints.push(
      "PWCLI_HINT: click target is covered; inspect active overlay/modal or click the visible parent trigger.",
    );
  }
  return hints.length > 0 ? `${errorText}\n${hints.join("\n")}` : errorText;
}
