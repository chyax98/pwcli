import { appendRunEvent, ensureRunDir } from "#store/artifacts.js";
import { assertSessionAutomationControl } from "#store/control-state.js";
import { buildDiagnosticsDelta, captureDiagnosticsBaseline } from "../diagnose/core.js";
import {
  parseErrorText,
  parsePageSummary,
  parseResultText,
  parseSnapshotYaml,
  runManagedSessionCommand,
} from "../session.js";
import {
  DIAGNOSTICS_STATE_KEY,
  isModalStateBlockedMessage,
  managedRunCode,
  maybeRawOutput,
  normalizeRef,
} from "../shared.js";
import { managedWorkspaceProjection, pageIdRuntimePrelude } from "../workspace.js";

export type ActionFailureCode =
  | "REF_STALE"
  | "ACTION_TARGET_NOT_FOUND"
  | "ACTION_TARGET_AMBIGUOUS"
  | "ACTION_TARGET_INDEX_OUT_OF_RANGE"
  | "ACTION_TIMEOUT_OR_NOT_ACTIONABLE"
  | "MODAL_STATE_BLOCKED";

export type ActionFailureRecovery = {
  kind: string;
  commands: string[];
};

export type ActionFailureInput = {
  code: ActionFailureCode;
  message: string;
  retryable?: boolean;
  suggestions: string[];
  recovery?: ActionFailureRecovery;
  details?: Record<string, unknown>;
};

export class ActionFailure extends Error {
  readonly code: ActionFailureCode;
  readonly retryable: boolean;
  readonly suggestions: string[];
  recovery?: ActionFailureRecovery;
  details?: Record<string, unknown>;

  constructor(input: ActionFailureInput) {
    super(input.message);
    this.name = "ActionFailure";
    this.code = input.code;
    this.retryable = Boolean(input.retryable);
    this.suggestions = input.suggestions;
    this.recovery = input.recovery;
    this.details = input.details;
  }
}

export function isActionFailure(error: unknown): error is ActionFailure {
  return error instanceof ActionFailure;
}

export type SelectorTarget = {
  selector: string;
  nth: number;
};

export type SemanticTarget =
  | { kind: "role"; role: string; name?: string; nth?: number }
  | { kind: "text"; text: string; nth?: number }
  | { kind: "label"; label: string; nth?: number }
  | { kind: "placeholder"; placeholder: string; nth?: number }
  | { kind: "testid"; testid: string; nth?: number };

export type NormalizedSemanticTarget = SemanticTarget & { nth: number };

export function normalizeSemanticTarget(target: SemanticTarget): NormalizedSemanticTarget {
  return {
    ...target,
    nth: Math.max(1, Math.floor(Number(target.nth ?? 1))),
  };
}

export function semanticLocatorExpression(target: NormalizedSemanticTarget): string {
  return target.kind === "role"
    ? `page.getByRole(${JSON.stringify(target.role)}, ${
        target.name ? `{ name: ${JSON.stringify(target.name)}, exact: false }` : "undefined"
      })`
    : target.kind === "text"
      ? `page.getByText(${JSON.stringify(target.text)}, { exact: false })`
      : target.kind === "label"
        ? `page.getByLabel(${JSON.stringify(target.label)}, { exact: false })`
        : target.kind === "placeholder"
          ? `page.getByPlaceholder(${JSON.stringify(target.placeholder)}, { exact: false })`
          : `page.getByTestId(${JSON.stringify((target as { kind: "testid"; testid: string; nth: number }).testid)})`;
}

export type RunEventTargetKind = "ref" | "selector" | "semantic" | "none";

export type RunEvent = {
  ts: string;
  command: string;
  sessionName: string | null;
  pageId: string | null;
  navigationId: string | null;
  targetKind: RunEventTargetKind;
  [key: string]: unknown;
};

export function buildRunEvent(
  command: string,
  sessionName: string | undefined,
  page: Record<string, unknown> | undefined,
  details: Record<string, unknown>,
  targetKind: RunEventTargetKind = "none",
): RunEvent {
  return {
    ts: new Date().toISOString(),
    command,
    sessionName: sessionName ?? null,
    pageId: typeof page?.pageId === "string" ? page.pageId : null,
    navigationId: typeof page?.navigationId === "string" ? page.navigationId : null,
    targetKind,
    ...details,
  };
}

export type RefEpochValidation =
  | {
      ok: true;
      ref: string;
      snapshotId: string;
      pageId: string | null;
      navigationId: string | null;
    }
  | {
      ok: false;
      code: "REF_STALE";
      ref: string;
      reason: "missing-snapshot" | "missing-ref" | "page-changed" | "navigation-changed";
      snapshotId?: string;
      snapshotPageId?: string | null;
      snapshotNavigationId?: string | null;
      currentPageId?: string | null;
      currentNavigationId?: string | null;
      currentUrl?: string;
    };

const VALID_REASONS = new Set([
  "missing-snapshot",
  "missing-ref",
  "page-changed",
  "navigation-changed",
]);

export function parseRefEpochValidation(raw: unknown): RefEpochValidation {
  if (raw !== null && typeof raw === "object" && (raw as Record<string, unknown>).ok === true) {
    return raw as RefEpochValidation & { ok: true };
  }
  const obj = (raw !== null && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const reason = VALID_REASONS.has(String(obj.reason))
    ? (obj.reason as RefEpochValidation & { ok: false })["reason"]
    : "missing-snapshot";
  return {
    ...(obj as object),
    ok: false,
    code: "REF_STALE",
    ref: typeof obj.ref === "string" ? obj.ref : "",
    reason,
  } as RefEpochValidation & { ok: false };
}

/**
 * Centralized interaction error codes and recovery policies.
 *
 * Browser-side JS source strings (e.g. CLICK_SEMANTIC_NOT_FOUND) are NOT
 * listed here — they are runtime literals executed inside the browser and
 * remain hard-coded in the source templates in interaction.ts.
 */

export const InteractionErrorCode = {
  REF_STALE: "REF_STALE",
  ACTION_TARGET_NOT_FOUND: "ACTION_TARGET_NOT_FOUND",
  ACTION_TARGET_AMBIGUOUS: "ACTION_TARGET_AMBIGUOUS",
  ACTION_TARGET_INDEX_OUT_OF_RANGE: "ACTION_TARGET_INDEX_OUT_OF_RANGE",
  ACTION_TIMEOUT_OR_NOT_ACTIONABLE: "ACTION_TIMEOUT_OR_NOT_ACTIONABLE",
  MODAL_STATE_BLOCKED: "MODAL_STATE_BLOCKED",
} as const satisfies Record<string, ActionFailureCode>;

export type InteractionErrorCode = (typeof InteractionErrorCode)[keyof typeof InteractionErrorCode];

function sessionFlag(sessionName: string | undefined): string {
  return `--session ${sessionName ?? "<name>"}`;
}

export function makeRecovery(
  kind: ActionFailureRecovery["kind"],
  commands: string[],
): ActionFailureRecovery {
  return { kind, commands };
}

export function reSnapshotRecovery(sessionName: string | undefined): ActionFailureRecovery {
  return makeRecovery("re-snapshot", [`pw snapshot -i ${sessionFlag(sessionName)}`]);
}

export function inspectRecovery(sessionName: string | undefined): ActionFailureRecovery {
  return makeRecovery("inspect", [
    `pw snapshot -i ${sessionFlag(sessionName)}`,
    `pw observe status ${sessionFlag(sessionName)}`,
  ]);
}

export function inspectWithStatusFirstRecovery(
  sessionName: string | undefined,
): ActionFailureRecovery {
  return makeRecovery("inspect", [
    `pw observe status ${sessionFlag(sessionName)}`,
    `pw snapshot -i ${sessionFlag(sessionName)}`,
  ]);
}

export function refStaleFailure(
  message: string,
  context: { command: string; sessionName?: string; ref?: string },
  overrides?: {
    retryable?: boolean;
    suggestions?: string[];
    recovery?: ActionFailureRecovery;
    details?: Record<string, unknown>;
  },
): ActionFailure {
  const session = context.sessionName ?? null;
  const baseDetails: Record<string, unknown> = { command: context.command, session };
  if (context.ref !== undefined) {
    baseDetails.ref = context.ref;
  }

  return new ActionFailure({
    code: InteractionErrorCode.REF_STALE,
    message,
    retryable: overrides?.retryable ?? true,
    suggestions: overrides?.suggestions ?? [
      `Refresh refs with \`pw snapshot -i ${sessionFlag(context.sessionName)}\``,
      "Retry with a fresh ref from the new snapshot",
      "Use a semantic locator such as --role or --text when the target must survive navigation or re-rendering",
    ],
    recovery: overrides?.recovery ?? reSnapshotRecovery(context.sessionName),
    details: overrides?.details ?? baseDetails,
  });
}

export function actionTargetAmbiguousFailure(
  message: string,
  context: { command: string; sessionName?: string },
): ActionFailure {
  const session = context.sessionName ?? null;
  return new ActionFailure({
    code: InteractionErrorCode.ACTION_TARGET_AMBIGUOUS,
    message,
    retryable: true,
    suggestions: [
      "Narrow the locator so it resolves to one target",
      "Pass --nth when multiple matching targets are expected",
      `Inspect the current snapshot with \`pw snapshot -i ${sessionFlag(context.sessionName)}\``,
    ],
    recovery: inspectRecovery(context.sessionName),
    details: { command: context.command, session },
  });
}

export function actionTargetIndexOutOfRangeFailure(
  message: string,
  context: { command: string; sessionName?: string },
): ActionFailure {
  const session = context.sessionName ?? null;
  return new ActionFailure({
    code: InteractionErrorCode.ACTION_TARGET_INDEX_OUT_OF_RANGE,
    message,
    retryable: true,
    suggestions: [
      "Pass an --nth value within the available target count",
      `Inspect the current snapshot with \`pw snapshot -i ${sessionFlag(context.sessionName)}\``,
      "Use a narrower selector or semantic locator when possible",
    ],
    recovery: inspectRecovery(context.sessionName),
    details: { command: context.command, session },
  });
}

export function actionTimeoutOrNotActionableFailure(
  message: string,
  context: { command: string; sessionName?: string },
): ActionFailure {
  const session = context.sessionName ?? null;
  return new ActionFailure({
    code: InteractionErrorCode.ACTION_TIMEOUT_OR_NOT_ACTIONABLE,
    message,
    retryable: true,
    suggestions: [
      "Wait for the target with a selector before retrying the action",
      `Check page readiness with \`pw observe status ${sessionFlag(context.sessionName)}\``,
      "Clear any dialog, modal, or overlay that may block the target",
    ],
    recovery: inspectWithStatusFirstRecovery(context.sessionName),
    details: { command: context.command, session },
  });
}

export function actionTargetNotFoundFailure(
  message: string,
  context: { command: string; sessionName?: string },
): ActionFailure {
  const session = context.sessionName ?? null;
  return new ActionFailure({
    code: InteractionErrorCode.ACTION_TARGET_NOT_FOUND,
    message,
    retryable: true,
    suggestions: [
      `Refresh refs with \`pw snapshot -i ${sessionFlag(context.sessionName)}\``,
      "Use an existing selector from the current page",
      "Use a semantic locator such as --role or --text when possible",
    ],
    recovery: inspectRecovery(context.sessionName),
    details: { command: context.command, session },
  });
}

export function modalStateBlockedFailure(
  message: string,
  context: { command: string; sessionName?: string },
): ActionFailure {
  const session = context.sessionName ?? null;
  return new ActionFailure({
    code: InteractionErrorCode.MODAL_STATE_BLOCKED,
    message,
    retryable: false,
    suggestions: [
      "Dismiss or accept the pending browser dialog before continuing",
      `Use \`pw dialog-accept\` or \`pw dialog-dismiss\` ${sessionFlag(context.sessionName)}`,
    ],
    recovery: makeRecovery("dialog", [
      `pw dialog-accept ${sessionFlag(context.sessionName)}`,
      `pw dialog-dismiss ${sessionFlag(context.sessionName)}`,
    ]),
    details: { command: context.command, session },
  });
}

type ManagedActionErrorContext = {
  command: string;
  sessionName?: string;
};

function isTargetNotFoundError(errorText: string) {
  if (
    /No element matches selector/i.test(errorText) ||
    /Unable to find/i.test(errorText) ||
    /(CLICK|FILL|TYPE|HOVER|CHECK|UNCHECK|SELECT|PRESS)_SEMANTIC_NOT_FOUND/i.test(errorText) ||
    /(CLICK|FILL|TYPE|HOVER|CHECK|UNCHECK|SELECT|PRESS)_SELECTOR_NOT_FOUND/i.test(errorText)
  ) {
    return true;
  }

  if (/not found/i.test(errorText) && !/\b(dialog|modal)\b/i.test(errorText)) {
    return true;
  }

  return false;
}

export function throwIfManagedActionError(text: string, context: ManagedActionErrorContext) {
  const errorText = parseErrorText(text);
  if (!errorText) {
    return;
  }

  throwManagedActionErrorText(errorText, context);
}

export function throwManagedActionErrorText(errorText: string, context: ManagedActionErrorContext) {
  const refMatch = errorText.match(
    /Ref\s+([A-Za-z0-9_-]+)\s+not found in the current page snapshot/i,
  );
  if (refMatch) {
    throw refStaleFailure(errorText, { ...context, ref: refMatch[1] });
  }

  if (/strict mode violation/i.test(errorText)) {
    throw actionTargetAmbiguousFailure(errorText, context);
  }

  if (/(CLICK|FILL|TYPE)_SEMANTIC_INDEX_OUT_OF_RANGE|INDEX_OUT_OF_RANGE/i.test(errorText)) {
    throw actionTargetIndexOutOfRangeFailure(errorText, context);
  }

  if (
    /timeout/i.test(errorText) ||
    /not visible|not enabled|not stable|receives pointer events/i.test(errorText)
  ) {
    throw actionTimeoutOrNotActionableFailure(errorText, context);
  }

  if (isTargetNotFoundError(errorText)) {
    throw actionTargetNotFoundFailure(errorText, context);
  }

  throw new Error(errorText);
}

export function selectorActionSource(
  errorPrefix: string,
  target: SelectorTarget,
  actionSource: (locatorExpression: string) => string,
) {
  const nthIndex = target.nth - 1;
  const targetJson = JSON.stringify(target);
  const locatorExpression = `page.locator(${JSON.stringify(target.selector)})`;
  const action = actionSource(`locator.nth(${nthIndex})`);
  const isClick = errorPrefix === "CLICK";
  const popupPre = isClick
    ? `const popupPromise = page.waitForEvent('popup', { timeout: 1500 }).catch(() => null);\n    `
    : "";
  const popupPost = isClick
    ? `\n    const popup = await popupPromise;\n    let openedPage = null;\n    if (popup) {\n      const context = page.context();\n      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ||= {};\n      state.nextPageSeq = Number.isInteger(state.nextPageSeq) ? state.nextPageSeq : 1;\n      const ensurePageId = (p) => {\n        if (!p.__pwcliPageId)\n          p.__pwcliPageId = 'p' + state.nextPageSeq++;\n        return p.__pwcliPageId;\n      };\n      const newPageId = ensurePageId(popup);\n      openedPage = { pageId: newPageId, url: popup.url(), title: await popup.title().catch(() => '') };\n    }`
    : "";
  const openedPageField = isClick ? `,\n      openedPage` : "";

  return `async page => {
    const target = ${targetJson};
    const locator = ${locatorExpression};
    const count = await locator.count();
    if (count === 0) {
      throw new Error(
        '${errorPrefix}_SELECTOR_NOT_FOUND:' +
          JSON.stringify({ target })
      );
    }
    if (${nthIndex} >= count) {
      throw new Error(
        '${errorPrefix}_SELECTOR_INDEX_OUT_OF_RANGE:' +
          JSON.stringify({ target, count, nth: ${target.nth} })
      );
    }
    ${popupPre}${action}${popupPost}
    return JSON.stringify({
      acted: true,
      selected: ${errorPrefix === "SELECT" ? "true" : "undefined"},
      values: typeof values === 'undefined' ? undefined : values,
      target,
      count,
      nth: ${target.nth}${openedPageField},
    });
  }`;
}

export function semanticClickSource(target: NormalizedSemanticTarget, button?: string) {
  const clickOptions = button ? JSON.stringify({ button }) : "undefined";
  const nthIndex = target.nth - 1;
  const targetJson = JSON.stringify(target);
  const locatorExpression = semanticLocatorExpression(target);

  return `async page => {
    const target = ${targetJson};
    const locator = ${locatorExpression};
    const count = await locator.count();
    if (count === 0) {
      let candidates = [];
      if (target.kind === 'text') {
        candidates = await page.getByText(target.text, { exact: false }).evaluateAll(nodes =>
          nodes.slice(0, 8).map(node => (node.textContent || '').trim()).filter(Boolean)
        ).catch(() => []);
      }
      throw new Error(
        'CLICK_SEMANTIC_NOT_FOUND:' +
          JSON.stringify({ target, ...(candidates.length ? { candidates } : {}) })
      );
    }
    if (${nthIndex} >= count) {
      throw new Error(
        'CLICK_SEMANTIC_INDEX_OUT_OF_RANGE:' +
          JSON.stringify({ target, count, nth: ${target.nth} })
      );
    }
    const popupPromise = page.waitForEvent('popup', { timeout: 1500 }).catch(() => null);
    await locator.nth(${nthIndex}).click(${clickOptions});
    const popup = await popupPromise;
    let openedPage = null;
    if (popup) {
      const context = page.context();
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ||= {};
      state.nextPageSeq = Number.isInteger(state.nextPageSeq) ? state.nextPageSeq : 1;
      const ensurePageId = (p) => {
        if (!p.__pwcliPageId)
          p.__pwcliPageId = 'p' + state.nextPageSeq++;
        return p.__pwcliPageId;
      };
      const newPageId = ensurePageId(popup);
      openedPage = { pageId: newPageId, url: popup.url(), title: await popup.title().catch(() => '') };
    }
    return JSON.stringify({ clicked: true, target, count, nth: ${target.nth}, openedPage });
  }`;
}

export function semanticBooleanControlSource(
  command: "check" | "uncheck",
  target: NormalizedSemanticTarget,
) {
  const nthIndex = target.nth - 1;
  const targetJson = JSON.stringify(target);
  const locatorExpression = semanticLocatorExpression(target);
  const errorPrefix = command.toUpperCase();

  return `async page => {
    const target = ${targetJson};
    const locator = ${locatorExpression};
    const count = await locator.count();
    if (count === 0) {
      throw new Error(
        '${errorPrefix}_SEMANTIC_NOT_FOUND:' +
          JSON.stringify({ target })
      );
    }
    if (${nthIndex} >= count) {
      throw new Error(
        '${errorPrefix}_SEMANTIC_INDEX_OUT_OF_RANGE:' +
          JSON.stringify({ target, count, nth: ${target.nth} })
      );
    }
    await locator.nth(${nthIndex}).${command}();
    return JSON.stringify({ ${command === "check" ? "checked" : "unchecked"}: true, target, count, nth: ${target.nth} });
  }`;
}

export function semanticInputSource(
  errorPrefix: "FILL" | "TYPE",
  target: NormalizedSemanticTarget,
  action: "fill" | "type",
  value: string,
) {
  const nthIndex = target.nth - 1;
  const targetJson = JSON.stringify(target);
  const locatorExpression = semanticLocatorExpression(target);

  return `async page => {
    const target = ${targetJson};
    const locator = ${locatorExpression};
    const count = await locator.count();
    if (count === 0) {
      throw new Error(
        '${errorPrefix}_SEMANTIC_NOT_FOUND:' +
          JSON.stringify({ target })
      );
    }
    if (${nthIndex} >= count) {
      throw new Error(
        '${errorPrefix}_SEMANTIC_INDEX_OUT_OF_RANGE:' +
          JSON.stringify({ target, count, nth: ${target.nth} })
      );
    }
    await locator.nth(${nthIndex}).${action}(${JSON.stringify(value)});
    return JSON.stringify({ ${action === "fill" ? "filled" : "typed"}: true });
  }`;
}

export function semanticHoverSource(target: NormalizedSemanticTarget) {
  const nthIndex = target.nth - 1;
  const targetJson = JSON.stringify(target);
  const locatorExpression = semanticLocatorExpression(target);

  return `async page => {
    const target = ${targetJson};
    const locator = ${locatorExpression};
    const count = await locator.count();
    if (count === 0) {
      throw new Error(
        'HOVER_SEMANTIC_NOT_FOUND:' +
          JSON.stringify({ target })
      );
    }
    if (${nthIndex} >= count) {
      throw new Error(
        'HOVER_SEMANTIC_INDEX_OUT_OF_RANGE:' +
          JSON.stringify({ target, count, nth: ${target.nth} })
      );
    }
    await locator.nth(${nthIndex}).hover();
    return JSON.stringify({ hovered: true, target, count, nth: ${target.nth} });
  }`;
}

export function semanticSelectSource(target: NormalizedSemanticTarget, value: string) {
  const nthIndex = target.nth - 1;
  const targetJson = JSON.stringify(target);
  const locatorExpression = semanticLocatorExpression(target);
  const valueJson = JSON.stringify(value);

  return `async page => {
    const target = ${targetJson};
    const locator = ${locatorExpression};
    const count = await locator.count();
    if (count === 0) {
      throw new Error(
        'SELECT_SEMANTIC_NOT_FOUND:' +
          JSON.stringify({ target })
      );
    }
    if (${nthIndex} >= count) {
      throw new Error(
        'SELECT_SEMANTIC_INDEX_OUT_OF_RANGE:' +
          JSON.stringify({ target, count, nth: ${target.nth} })
      );
    }
    const values = await locator.nth(${nthIndex}).selectOption(${valueJson});
    return JSON.stringify({ selected: true, target, count, nth: ${target.nth}, values });
  }`;
}

export function semanticPressSource(target: NormalizedSemanticTarget, key: string) {
  const nthIndex = target.nth - 1;
  const targetJson = JSON.stringify(target);
  const locatorExpression = semanticLocatorExpression(target);
  const keyJson = JSON.stringify(key);

  return `async page => {
    const target = ${targetJson};
    const locator = ${locatorExpression};
    const count = await locator.count();
    if (count === 0) {
      throw new Error(
        'PRESS_SEMANTIC_NOT_FOUND:' +
          JSON.stringify({ target })
      );
    }
    if (${nthIndex} >= count) {
      throw new Error(
        'PRESS_SEMANTIC_INDEX_OUT_OF_RANGE:' +
          JSON.stringify({ target, count, nth: ${target.nth} })
      );
    }
    await locator.nth(${nthIndex}).press(${keyJson});
    return JSON.stringify({ pressed: true, target, count, nth: ${target.nth} });
  }`;
}

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

async function managedSnapshot(options?: {
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
  const MAX_LINES = 200;

  // 2. Remove empty lines: consecutive empty lines merge to single empty line
  let result = mergeConsecutiveEmptyLines(lines);

  // 3. Depth limit: nodes with indent > 12 levels (24 spaces) collapse
  result = applyDepthLimit(result);

  // 4. Fold repeats: 3+ consecutive identical role+name patterns
  result = foldRepeats(result);

  // 1. Line limit: cap at 200 lines
  if (result.length > MAX_LINES) {
    const omitted = result.length - MAX_LINES;
    result = result.slice(0, MAX_LINES);
    result.push(`# ... (${omitted} more lines)`);
  }

  return result;
}

function mergeConsecutiveEmptyLines(lines: string[]): string[] {
  const result: string[] = [];
  let lastWasEmpty = false;
  for (const line of lines) {
    const isEmpty = line.trim() === "";
    if (isEmpty) {
      if (!lastWasEmpty) {
        result.push("");
        lastWasEmpty = true;
      }
    } else {
      result.push(line);
      lastWasEmpty = false;
    }
  }
  return result;
}

function applyDepthLimit(lines: string[]): string[] {
  const result: string[] = [];
  let skipUntilIndent: number | null = null;
  for (const line of lines) {
    const isEmpty = line.trim() === "";
    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (skipUntilIndent !== null && !isEmpty && indent > skipUntilIndent) {
      continue;
    }
    if (skipUntilIndent !== null && !isEmpty && indent <= skipUntilIndent) {
      skipUntilIndent = null;
    }
    if (!isEmpty && indent > 24) {
      result.push("  # ... (deep subtree)");
      skipUntilIndent = indent;
    } else {
      result.push(line);
    }
  }
  return result;
}

function foldRepeats(lines: string[]): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(/^(\s*)-\s+([a-zA-Z][a-zA-Z0-9_-]*)(?:\s+"([^"]*)")?/);
    if (!match) {
      result.push(line);
      i++;
      continue;
    }
    const indent = match[1];
    const role = match[2];
    const name = match[3] ?? "";
    let count = 1;
    let j = i + 1;
    while (j < lines.length) {
      const nextMatch = lines[j].match(/^(\s*)-\s+([a-zA-Z][a-zA-Z0-9_-]*)(?:\s+"([^"]*)")?/);
      if (!nextMatch) break;
      if (nextMatch[1] !== indent || nextMatch[2] !== role || (nextMatch[3] ?? "") !== name) break;
      count++;
      j++;
    }
    if (count >= 3) {
      result.push(lines[i]);
      result.push(lines[i + 1]);
      result.push(`${indent}# × ${count - 2} more`);
      i = j;
    } else {
      result.push(line);
      i++;
    }
  }
  return result;
}

export type DiagnosticsBaseline = {
  consoleTotal: number;
  networkTotal: number;
  pageErrorTotal: number;
};

export type ManagedSessionMeta = {
  scope: "managed";
  name: string;
  default: boolean;
};

export type ManagedCodeResult = Awaited<ReturnType<typeof managedRunCode>>;

export type ActionResultEnvelope = {
  session: ManagedSessionMeta;
  page: Record<string, unknown> | undefined;
  data: Record<string, unknown>;
};

export type RunRecord = Awaited<ReturnType<typeof ensureRunDir>>;

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function errorCode(error: unknown, fallback: string) {
  return error instanceof ActionFailure ? error.code : fallback;
}

export function errorRetryable(error: unknown) {
  return error instanceof ActionFailure ? error.retryable : undefined;
}

export function errorSuggestions(error: unknown) {
  return error instanceof ActionFailure ? error.suggestions : undefined;
}

export function errorDetails(error: unknown) {
  return error instanceof ActionFailure ? error.details : undefined;
}

export function attachFailureRun(error: unknown, run: RunRecord) {
  if (!(error instanceof ActionFailure)) {
    return;
  }
  const details = {
    ...(error.details ?? {}),
    run,
  };
  Object.defineProperty(error, "details", {
    value: details,
    configurable: true,
  });
}

export function isModalBlockedDelta(delta: Record<string, unknown>) {
  return delta.unavailable === true && isModalStateBlockedMessage(errorMessage(delta.reason));
}

export async function recordActionRun(
  command: string,
  sessionName: string | undefined,
  page: Record<string, unknown> | undefined,
  details: Record<string, unknown>,
  targetKind?: RunEventTargetKind,
): Promise<RunRecord> {
  const run = await ensureRunDir(sessionName);
  const event = buildRunEvent(command, sessionName, page, details, targetKind ?? "none");
  await appendRunEvent(run.runDir, event);
  return run;
}

export async function recordFailedActionRun(
  command: string,
  sessionName: string | undefined,
  page: Record<string, unknown> | undefined,
  before: DiagnosticsBaseline,
  error: unknown,
  details: Record<string, unknown> = {},
): Promise<RunRecord> {
  const diagnosticsDelta = await buildDiagnosticsDeltaOrSignal(sessionName, before);
  const run = await recordActionRun(command, sessionName, page, {
    ...details,
    status: "failed",
    failed: true,
    diagnosticsDelta,
    failure: {
      code: errorCode(error, `${command.toUpperCase()}_FAILED`),
      message: errorMessage(error),
      retryable: errorRetryable(error) ?? null,
      suggestions: errorSuggestions(error) ?? [],
      details: errorDetails(error) ?? null,
    },
  });
  attachFailureRun(error, run);
  return run;
}

export async function buildDiagnosticsDeltaOrSignal(
  sessionName: string | undefined,
  before: DiagnosticsBaseline,
): Promise<Record<string, unknown>> {
  try {
    return await buildDiagnosticsDelta(sessionName, before);
  } catch (error) {
    return {
      unavailable: true,
      reason: errorMessage(error),
    };
  }
}

export async function validateRefEpoch(options: {
  sessionName?: string;
  ref: string;
}): Promise<RefEpochValidation> {
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      ${pageIdRuntimePrelude()}

      const epoch = state.lastSnapshotRefEpoch || null;
      const currentPageId = ensurePageId(page) || null;
      const currentNavigationId = ensureNavigationId(page) || null;
      const ref = ${JSON.stringify(options.ref)};

      if (!epoch) {
        return JSON.stringify({
          ok: false,
          code: 'REF_STALE',
          ref,
          reason: 'missing-snapshot',
          currentPageId,
          currentNavigationId,
          currentUrl: page.url(),
        });
      }

      if (epoch.pageId && currentPageId && epoch.pageId !== currentPageId) {
        return JSON.stringify({
          ok: false,
          code: 'REF_STALE',
          ref,
          reason: 'page-changed',
          snapshotId: epoch.snapshotId,
          snapshotPageId: epoch.pageId,
          snapshotNavigationId: epoch.navigationId || null,
          currentPageId,
          currentNavigationId,
          currentUrl: page.url(),
        });
      }

      if (epoch.navigationId && currentNavigationId && epoch.navigationId !== currentNavigationId) {
        return JSON.stringify({
          ok: false,
          code: 'REF_STALE',
          ref,
          reason: 'navigation-changed',
          snapshotId: epoch.snapshotId,
          snapshotPageId: epoch.pageId || null,
          snapshotNavigationId: epoch.navigationId,
          currentPageId,
          currentNavigationId,
          currentUrl: page.url(),
        });
      }

      if (!Array.isArray(epoch.refs) || !epoch.refs.includes(ref)) {
        return JSON.stringify({
          ok: false,
          code: 'REF_STALE',
          ref,
          reason: 'missing-ref',
          snapshotId: epoch.snapshotId,
          snapshotPageId: epoch.pageId || null,
          snapshotNavigationId: epoch.navigationId || null,
          currentPageId,
          currentNavigationId,
          currentUrl: page.url(),
        });
      }

      return JSON.stringify({
        ok: true,
        ref,
        snapshotId: epoch.snapshotId,
        pageId: currentPageId,
        navigationId: currentNavigationId,
      });
    }`,
  });
  return result.data.result as RefEpochValidation;
}

export async function assertFreshRefEpoch(options: { sessionName?: string; ref: string }) {
  const validation = await validateRefEpoch(options);
  if (validation.ok) {
    return;
  }

  let freshSnapshotCaptured = false;
  let freshSnapshotRefCount: number | undefined;
  try {
    const fresh = await managedSnapshot({
      sessionName: options.sessionName,
      interactive: true,
      skipEpoch: true,
    });
    freshSnapshotCaptured = true;
    const snapshotText = typeof fresh.data?.snapshot === "string" ? fresh.data.snapshot : "";
    const refMatches = snapshotText.match(/\[ref=[^\]]+\]/g);
    freshSnapshotRefCount = refMatches?.length;
  } catch {
    // snapshot capture failed — still throw the original REF_STALE
  }

  const sessionFlag = `--session ${options.sessionName ?? "<name>"}`;
  throw new ActionFailure({
    code: "REF_STALE",
    message: `Ref ${options.ref} is stale for the current page snapshot`,
    retryable: false,
    recovery: {
      kind: "re-snapshot",
      commands: [`pw snapshot -i ${sessionFlag}`],
    },
    details: {
      ...(validation as unknown as Record<string, unknown>),
      recovery: {
        action: "re-snapshot",
        freshSnapshotCaptured,
        freshSnapshotRefCount: freshSnapshotRefCount ?? null,
        previousEpoch: {
          snapshotId: (validation as Record<string, unknown>).snapshotId ?? null,
          pageId: (validation as Record<string, unknown>).snapshotPageId ?? null,
          navigationId: (validation as Record<string, unknown>).snapshotNavigationId ?? null,
        },
        currentEpoch: {
          pageId: (validation as Record<string, unknown>).currentPageId ?? null,
          navigationId: (validation as Record<string, unknown>).currentNavigationId ?? null,
          url: (validation as Record<string, unknown>).currentUrl ?? null,
        },
        nextSteps: [`pw snapshot -i ${sessionFlag}`, "重新选择 ref 后再执行 action"],
      },
    },
    suggestions: [
      freshSnapshotCaptured
        ? `Fresh snapshot captured (${freshSnapshotRefCount ?? "?"} refs) — run \`pw snapshot -i ${sessionFlag}\` to see them`
        : `Refresh refs with \`pw snapshot -i ${sessionFlag}\``,
      "Pick a new ref from the fresh snapshot and retry the action",
    ],
  });
}

export async function executeCodeAction(options: {
  command: string;
  sessionName?: string;
  source: string;
  before: DiagnosticsBaseline;
  target?: Record<string, unknown>;
  details?: Record<string, unknown>;
}): Promise<ManagedCodeResult> {
  try {
    return await managedRunCode({ sessionName: options.sessionName, source: options.source });
  } catch (error) {
    if (error instanceof Error) {
      throwManagedActionErrorText(error.message, {
        command: options.command,
        sessionName: options.sessionName,
      });
    }
    throw error;
  }
}

export async function runManagedCommand(options: { sessionName?: string; argv: string[] }) {
  const result = await runManagedSessionCommand(
    { _: options.argv },
    { sessionName: options.sessionName },
  );
  return {
    sessionName: result.sessionName,
    text: result.text,
    page: parsePageSummary(result.text),
  };
}

export async function validateCommandResult(options: {
  text: string;
  command: string;
  sessionName?: string;
  before: DiagnosticsBaseline;
  page?: Record<string, unknown> | undefined;
  target?: Record<string, unknown>;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    throwIfManagedActionError(options.text, {
      command: options.command,
      sessionName: options.sessionName,
    });
  } catch (error) {
    await recordFailedActionRun(
      options.command,
      options.sessionName,
      options.page,
      options.before,
      error,
      {
        ...(options.target ? { target: options.target } : {}),
        ...(options.details ?? {}),
      },
    );
    throw error;
  }
}

export async function executeCommandAction(options: {
  command: string;
  sessionName?: string;
  argv: string[];
  before: DiagnosticsBaseline;
  target?: Record<string, unknown>;
  details?: Record<string, unknown>;
}): Promise<{ sessionName: string; text: string; page: Record<string, unknown> | undefined }> {
  const { sessionName, text, page } = await runManagedCommand({
    sessionName: options.sessionName,
    argv: options.argv,
  });
  await validateCommandResult({
    text,
    command: options.command,
    sessionName,
    before: options.before,
    page,
    target: options.target,
    details: options.details,
  });
  return { sessionName, text, page };
}

export async function buildDialogPendingResult(options: {
  command: string;
  sessionName?: string;
  resultText?: string;
  page?: Record<string, unknown> | undefined;
  target?: Record<string, unknown>;
  before: DiagnosticsBaseline;
  diagnosticsDelta?: Record<string, unknown>;
}): Promise<ActionResultEnvelope> {
  const diagnosticsDelta =
    options.diagnosticsDelta ??
    (await buildDiagnosticsDeltaOrSignal(options.sessionName, options.before));
  const run = await recordActionRun(options.command, options.sessionName, options.page, {
    ...(options.target ? { target: options.target } : {}),
    status: "dialog-pending",
    acted: true,
    modalPending: true,
    diagnosticsDelta,
    failureSignal: {
      code: "MODAL_STATE_BLOCKED",
      message: "action fired and a browser dialog is pending",
    },
  });
  return {
    session: {
      scope: "managed",
      name: options.sessionName ?? "default",
      default: !options.sessionName || options.sessionName === "default",
    },
    page: options.page,
    data: {
      ...(options.target ? { target: options.target } : {}),
      acted: true,
      modalPending: true,
      blockedState: "MODAL_STATE_BLOCKED",
      diagnosticsDelta,
      run,
      ...(options.resultText ? maybeRawOutput(options.resultText) : {}),
    },
  };
}

export async function finalizeAction(options: {
  command: string;
  sessionName?: string;
  page: Record<string, unknown> | undefined;
  before: DiagnosticsBaseline;
  resultData: Record<string, unknown>;
  runDetails: Record<string, unknown>;
  targetKind: RunEventTargetKind;
  rawText?: string;
}): Promise<ActionResultEnvelope> {
  const diagnosticsDelta = await buildDiagnosticsDeltaOrSignal(options.sessionName, options.before);
  const run = await recordActionRun(
    options.command,
    options.sessionName,
    options.page,
    {
      ...options.runDetails,
      diagnosticsDelta,
    },
    options.targetKind,
  );
  return {
    session: {
      scope: "managed",
      name: options.sessionName ?? "default",
      default: !options.sessionName || options.sessionName === "default",
    },
    page: options.page,
    data: {
      ...options.resultData,
      diagnosticsDelta,
      run,
      ...(options.rawText ? maybeRawOutput(options.rawText) : {}),
    },
  };
}

export async function dispatchLocatorAction(options: {
  command: string;
  sessionName?: string;
  before: DiagnosticsBaseline;
  locator:
    | { kind: "semantic"; target: NormalizedSemanticTarget; source: string }
    | { kind: "selector"; target: SelectorTarget; source: string }
    | { kind: "ref"; ref: string; argv: string[] };
  resultData: Record<string, unknown>;
  runDetails?: Record<string, unknown>;
  allowModal?: boolean;
  pickFromResult?: string[];
}): Promise<ActionResultEnvelope> {
  const { command, sessionName, before, locator, allowModal } = options;
  const runDetails = options.runDetails ?? options.resultData;

  if (locator.kind === "semantic" || locator.kind === "selector") {
    const targetRecord = locator.target as Record<string, unknown>;
    let result: ManagedCodeResult;
    try {
      result = await executeCodeAction({
        command,
        sessionName,
        source: locator.source,
        before,
        target: targetRecord,
      });
    } catch (error) {
      if (allowModal && isModalStateBlockedMessage(errorMessage(error))) {
        return buildDialogPendingResult({ command, sessionName, target: targetRecord, before });
      }
      await recordFailedActionRun(command, sessionName, undefined, before, error, {
        target: targetRecord,
      });
      throw error;
    }
    if (allowModal) {
      const delta = await buildDiagnosticsDeltaOrSignal(sessionName, before);
      if (isModalBlockedDelta(delta)) {
        return buildDialogPendingResult({
          command,
          sessionName,
          page: result.page,
          target: targetRecord,
          before,
          diagnosticsDelta: delta,
        });
      }
    }
    const actionResult = (result.data?.result as Record<string, unknown>) ?? {};
    const picked = options.pickFromResult
      ? Object.fromEntries(
          options.pickFromResult.filter((k) => k in actionResult).map((k) => [k, actionResult[k]]),
        )
      : {};
    return finalizeAction({
      command,
      sessionName,
      page: result.page,
      before,
      resultData: { ...options.resultData, ...picked },
      runDetails,
      targetKind: locator.kind,
    });
  }

  // ref path
  const { ref, argv } = locator;
  await assertFreshRefEpoch({ sessionName, ref });

  let beforePages: Array<{ pageId: string }> = [];
  if (command === "click") {
    const beforeProjection = await managedWorkspaceProjection({ sessionName });
    beforePages = (beforeProjection.data.workspace.pages as Array<{ pageId: string }>) ?? [];
  }

  const {
    sessionName: resolvedSession,
    text,
    page,
  } = await runManagedCommand({ sessionName, argv });

  let refResultData = options.resultData;
  if (command === "click") {
    const afterProjection = await managedWorkspaceProjection({ sessionName: resolvedSession });
    const afterPages = (afterProjection.data.workspace.pages as Array<{ pageId: string }>) ?? [];
    const beforeIds = new Set(beforePages.map((p) => p.pageId));
    const newPage = afterPages.find((p) => !beforeIds.has(p.pageId));
    if (newPage) {
      refResultData = {
        ...options.resultData,
        openedPage: {
          pageId: newPage.pageId,
          url: (newPage as Record<string, unknown>).url,
          title: (newPage as Record<string, unknown>).title,
        },
      };
    }
  }

  try {
    throwIfManagedActionError(text, { command, sessionName: resolvedSession });
  } catch (error) {
    if (allowModal && isModalStateBlockedMessage(errorMessage(error))) {
      return buildDialogPendingResult({
        command,
        sessionName: resolvedSession,
        resultText: text,
        page,
        target: { ref },
        before,
      });
    }
    await recordFailedActionRun(command, resolvedSession, page, before, error, { target: { ref } });
    throw error;
  }
  if (allowModal) {
    const delta = await buildDiagnosticsDeltaOrSignal(sessionName, before);
    if (isModalBlockedDelta(delta)) {
      return buildDialogPendingResult({
        command,
        sessionName: resolvedSession,
        resultText: text,
        page,
        target: { ref },
        before,
        diagnosticsDelta: delta,
      });
    }
  }
  return finalizeAction({
    command,
    sessionName: resolvedSession,
    page,
    before,
    resultData: refResultData,
    runDetails,
    targetKind: "ref",
    rawText: text,
  });
}

// =============================================================================
// managedSnapshotStatus (diagnostic query, not an action — kept as-is)
// =============================================================================

export async function managedSnapshotStatus(options?: { sessionName?: string }) {
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      ${pageIdRuntimePrelude()}

      const epoch = state.lastSnapshotRefEpoch || null;
      const currentPageId = ensurePageId(page) || null;
      const currentNavigationId = ensureNavigationId(page) || null;

      if (!epoch) {
        return JSON.stringify({
          status: 'missing',
          detail: 'no snapshot has been taken for this session',
          currentPageId,
          currentNavigationId,
          currentUrl: page.url(),
        });
      }

      if (epoch.pageId && currentPageId && epoch.pageId !== currentPageId) {
        return JSON.stringify({
          status: 'navigated',
          detail: 'page changed since snapshot',
          snapshotId: epoch.snapshotId,
          snapshotPageId: epoch.pageId,
          snapshotNavigationId: epoch.navigationId || null,
          snapshotRefCount: Array.isArray(epoch.refs) ? epoch.refs.length : 0,
          currentPageId,
          currentNavigationId,
          currentUrl: page.url(),
        });
      }

      if (epoch.navigationId && currentNavigationId && epoch.navigationId !== currentNavigationId) {
        return JSON.stringify({
          status: 'stale',
          detail: 'navigation changed since snapshot',
          snapshotId: epoch.snapshotId,
          snapshotPageId: epoch.pageId || null,
          snapshotNavigationId: epoch.navigationId,
          snapshotRefCount: Array.isArray(epoch.refs) ? epoch.refs.length : 0,
          currentPageId,
          currentNavigationId,
          currentUrl: page.url(),
        });
      }

      // Detect visible HTML modals that may block interactions.
      const modalSelectors = [
        '[role="dialog"]',
        '[role="alertdialog"]',
        '[aria-modal="true"]',
        '.modal',
        '.ant-modal',
        '.el-dialog',
      ];
      const blockingModals = await page.evaluate((selectors) => {
        return Array.from(document.querySelectorAll(selectors.join(',')))
          .filter(el => {
            if (!(el instanceof HTMLElement)) return false;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          })
          .map(el => {
            const text = (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
            return {
              role: el.getAttribute('role') || 'dialog',
              text: text.substring(0, 100),
            };
          })
          .filter(m => m.text);
      }, modalSelectors);

      return JSON.stringify({
        status: 'fresh',
        detail: blockingModals.length > 0
          ? 'snapshot matches current page state, but ' + blockingModals.length + ' modal(s) may block interactions'
          : 'snapshot matches current page state',
        snapshotId: epoch.snapshotId,
        pageId: currentPageId,
        navigationId: currentNavigationId,
        refCount: Array.isArray(epoch.refs) ? epoch.refs.length : 0,
        currentUrl: page.url(),
        blockingModals: blockingModals.length > 0 ? blockingModals : undefined,
      });
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};
  return {
    session: result.session,
    page: result.page,
    data: {
      ...parsed,
      ...maybeRawOutput(result.rawText ?? ""),
    },
  };
}

// =============================================================================
// managedClick — uses executeAction pattern with detectModal
// =============================================================================

export async function managedClick(options: {
  ref?: string;
  selector?: string;
  nth?: number;
  semantic?: SemanticTarget;
  button?: string;
  sessionName?: string;
}) {
  if (!options.ref && !options.selector && !options.semantic) {
    throw new Error("click requires a ref, selector, or semantic locator");
  }
  await assertSessionAutomationControl(options.sessionName, "click");
  const before = await captureDiagnosticsBaseline(options.sessionName);
  const nth = Math.max(1, Math.floor(Number(options.nth ?? 1)));
  const clickOpts = options.button ? JSON.stringify({ button: options.button }) : "undefined";
  const locator = options.semantic
    ? (() => {
        const t = normalizeSemanticTarget(options.semantic!);
        return {
          kind: "semantic" as const,
          target: t,
          source: semanticClickSource(t, options.button),
        };
      })()
    : options.selector
      ? {
          kind: "selector" as const,
          target: { selector: options.selector, nth },
          source: selectorActionSource(
            "CLICK",
            { selector: options.selector, nth },
            (l) => `await ${l}.click(${clickOpts});`,
          ),
        }
      : {
          kind: "ref" as const,
          ref: normalizeRef(options.ref!),
          argv: ["click", normalizeRef(options.ref!), ...(options.button ? [options.button] : [])],
        };
  const tgt =
    "target" in locator
      ? (locator.target as Record<string, unknown>)
      : { ref: (locator as { ref: string }).ref };
  return dispatchLocatorAction({
    command: "click",
    sessionName: options.sessionName,
    before,
    locator,
    resultData: { target: tgt, ...(options.button ? { button: options.button } : {}), acted: true },
    allowModal: true,
    pickFromResult: ["openedPage"],
  });
}

// =============================================================================
// managedFill
// =============================================================================

export async function managedFill(options: {
  ref?: string;
  selector?: string;
  nth?: number;
  semantic?: SemanticTarget;
  value: string;
  sessionName?: string;
}) {
  if (!options.ref && !options.selector && !options.semantic) {
    throw new Error("fill requires a ref, selector, or semantic locator");
  }
  await assertSessionAutomationControl(options.sessionName, "fill");
  const before = await captureDiagnosticsBaseline(options.sessionName);
  const nth = Math.max(1, Math.floor(Number(options.nth ?? 1)));
  const locator = options.semantic
    ? (() => {
        const t = normalizeSemanticTarget(options.semantic!);
        return {
          kind: "semantic" as const,
          target: t,
          source: semanticInputSource("FILL", t, "fill", options.value),
        };
      })()
    : options.selector
      ? {
          kind: "selector" as const,
          target: { selector: options.selector, nth },
          source: selectorActionSource(
            "FILL",
            { selector: options.selector, nth },
            (l) => `await ${l}.fill(${JSON.stringify(options.value)});`,
          ),
        }
      : {
          kind: "ref" as const,
          ref: normalizeRef(options.ref!),
          argv: ["fill", normalizeRef(options.ref!), options.value],
        };
  const tgt =
    "target" in locator
      ? (locator.target as Record<string, unknown>)
      : { ref: (locator as { ref: string }).ref };
  return dispatchLocatorAction({
    command: "fill",
    sessionName: options.sessionName,
    before,
    locator,
    resultData: { target: tgt, value: options.value, filled: true },
  });
}

// =============================================================================
// managedType
// =============================================================================

export async function managedType(options: {
  ref?: string;
  selector?: string;
  nth?: number;
  semantic?: SemanticTarget;
  value: string;
  sessionName?: string;
}) {
  await assertSessionAutomationControl(options.sessionName, "type");
  const before = await captureDiagnosticsBaseline(options.sessionName);

  if (options.semantic) {
    const target = normalizeSemanticTarget(options.semantic);
    return dispatchLocatorAction({
      command: "type",
      sessionName: options.sessionName,
      before,
      locator: {
        kind: "semantic",
        target,
        source: semanticInputSource("TYPE", target, "type", options.value),
      },
      resultData: { target, value: options.value, typed: true },
    });
  }

  if (!options.ref && !options.selector) {
    const { sessionName, text, page } = await executeCommandAction({
      command: "type",
      sessionName: options.sessionName,
      argv: ["type", options.value],
      before,
    });
    return finalizeAction({
      command: "type",
      sessionName,
      page,
      before,
      resultData: { value: options.value, typed: true },
      runDetails: { value: options.value, typed: true },
      targetKind: "none",
      rawText: text,
    });
  }

  const nth = Math.max(1, Math.floor(Number(options.nth ?? 1)));
  const locator = options.selector
    ? {
        kind: "selector" as const,
        target: { selector: options.selector, nth },
        source: selectorActionSource(
          "TYPE",
          { selector: options.selector, nth },
          (locatorHandle) => `await ${locatorHandle}.type(${JSON.stringify(options.value)});`,
        ),
      }
    : {
        kind: "ref" as const,
        ref: normalizeRef(options.ref!),
        argv: ["type", normalizeRef(options.ref!), options.value],
      };

  const resultData =
    locator.kind === "selector"
      ? {
          target: locator.target,
          selector: locator.target.selector,
          nth: locator.target.nth,
          value: options.value,
          typed: true,
        }
      : { ref: locator.ref, value: options.value, typed: true };
  const runDetails =
    locator.kind === "selector"
      ? { target: locator.target, value: options.value, typed: true }
      : resultData;

  return dispatchLocatorAction({
    command: "type",
    sessionName: options.sessionName,
    before,
    locator,
    resultData,
    runDetails,
  });
}

// =============================================================================
// managedPress
// =============================================================================

export async function managedPress(key: string, options?: { sessionName?: string }) {
  await assertSessionAutomationControl(options?.sessionName, "press");
  const before = await captureDiagnosticsBaseline(options?.sessionName);
  const { sessionName, text, page } = await executeCommandAction({
    command: "press",
    sessionName: options?.sessionName,
    argv: ["press", key],
    before,
    details: { key },
  });
  return finalizeAction({
    command: "press",
    sessionName,
    page,
    before,
    resultData: { key, pressed: true },
    runDetails: { key, pressed: true },
    targetKind: "none",
    rawText: text,
  });
}

// =============================================================================
// managedBooleanControlAction (check / uncheck)
// =============================================================================

async function managedBooleanControlAction(
  command: "check" | "uncheck",
  options: {
    ref?: string;
    selector?: string;
    nth?: number;
    semantic?: SemanticTarget;
    sessionName?: string;
  },
) {
  if (!options.ref && !options.selector && !options.semantic) {
    throw new Error(`${command} requires a ref, selector, or semantic locator`);
  }
  await assertSessionAutomationControl(options.sessionName, command);
  const before = await captureDiagnosticsBaseline(options.sessionName);
  const nth = Math.max(1, Math.floor(Number(options.nth ?? 1)));
  const locator = options.semantic
    ? (() => {
        const t = normalizeSemanticTarget(options.semantic!);
        return {
          kind: "semantic" as const,
          target: t,
          source: semanticBooleanControlSource(command, t),
        };
      })()
    : options.selector
      ? {
          kind: "selector" as const,
          target: { selector: options.selector, nth },
          source: selectorActionSource(
            command.toUpperCase(),
            { selector: options.selector, nth },
            (l) => `await ${l}.${command}();`,
          ),
        }
      : {
          kind: "ref" as const,
          ref: normalizeRef(options.ref!),
          argv: [command, normalizeRef(options.ref!)],
        };
  const tgt =
    "target" in locator
      ? (locator.target as Record<string, unknown>)
      : { ref: (locator as { ref: string }).ref };
  return dispatchLocatorAction({
    command,
    sessionName: options.sessionName,
    before,
    locator,
    resultData: { target: tgt, acted: true, checked: command === "check" },
  });
}

export async function managedCheck(options: {
  ref?: string;
  selector?: string;
  nth?: number;
  semantic?: SemanticTarget;
  sessionName?: string;
}) {
  return managedBooleanControlAction("check", options);
}

export async function managedUncheck(options: {
  ref?: string;
  selector?: string;
  nth?: number;
  semantic?: SemanticTarget;
  sessionName?: string;
}) {
  return managedBooleanControlAction("uncheck", options);
}

// =============================================================================
// managedHover
// =============================================================================

export async function managedHover(options: {
  ref?: string;
  selector?: string;
  nth?: number;
  semantic?: SemanticTarget;
  sessionName?: string;
}) {
  if (!options.ref && !options.selector && !options.semantic) {
    throw new Error("hover requires a ref, selector, or semantic locator");
  }
  await assertSessionAutomationControl(options.sessionName, "hover");
  const before = await captureDiagnosticsBaseline(options.sessionName);
  const nth = Math.max(1, Math.floor(Number(options.nth ?? 1)));
  const locator = options.semantic
    ? (() => {
        const t = normalizeSemanticTarget(options.semantic!);
        return { kind: "semantic" as const, target: t, source: semanticHoverSource(t) };
      })()
    : options.selector
      ? {
          kind: "selector" as const,
          target: { selector: options.selector, nth },
          source: selectorActionSource(
            "HOVER",
            { selector: options.selector, nth },
            (l) => `await ${l}.hover();`,
          ),
        }
      : {
          kind: "ref" as const,
          ref: normalizeRef(options.ref!),
          argv: ["hover", normalizeRef(options.ref!)],
        };
  const tgt =
    "target" in locator
      ? (locator.target as Record<string, unknown>)
      : { ref: (locator as { ref: string }).ref };
  return dispatchLocatorAction({
    command: "hover",
    sessionName: options.sessionName,
    before,
    locator,
    resultData: { ...tgt, acted: true },
    allowModal: true,
  });
}

// =============================================================================
// managedSelect
// =============================================================================

export async function managedSelect(options: {
  ref?: string;
  selector?: string;
  nth?: number;
  semantic?: SemanticTarget;
  sessionName?: string;
  value: string;
}) {
  if (!options.ref && !options.selector && !options.semantic) {
    throw new Error("select requires a ref, selector, or semantic locator");
  }
  await assertSessionAutomationControl(options.sessionName, "select");

  const before = await captureDiagnosticsBaseline(options.sessionName);
  const nth = Math.max(1, Math.floor(Number(options.nth ?? 1)));
  const locator = options.semantic
    ? (() => {
        const target = normalizeSemanticTarget(options.semantic!);
        return {
          kind: "semantic" as const,
          target,
          source: semanticSelectSource(target, options.value),
        };
      })()
    : options.selector
      ? {
          kind: "selector" as const,
          target: { selector: options.selector, nth },
          source: selectorActionSource(
            "SELECT",
            { selector: options.selector, nth },
            (locatorHandle) =>
              `await ${locatorHandle}.selectOption(${JSON.stringify(options.value)});`,
          ),
        }
      : {
          kind: "ref" as const,
          ref: normalizeRef(options.ref!),
          argv: ["select", normalizeRef(options.ref!), options.value],
        };

  const resultData =
    locator.kind === "semantic"
      ? {
          target: locator.target,
          value: options.value,
          values: [options.value],
          selected: true,
        }
      : locator.kind === "selector"
        ? {
            target: locator.target,
            selector: locator.target.selector,
            nth: locator.target.nth,
            value: options.value,
            values: [options.value],
            selected: true,
          }
        : { ref: locator.ref, value: options.value, selected: true };
  const runDetails =
    locator.kind === "selector"
      ? { target: locator.target, value: options.value, selected: true }
      : locator.kind === "semantic"
        ? { target: locator.target, value: options.value, selected: true }
        : resultData;

  return dispatchLocatorAction({
    command: "select",
    sessionName: options.sessionName,
    before,
    locator,
    resultData,
    runDetails,
  });
}
