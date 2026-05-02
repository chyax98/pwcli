import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  type RefEpochValidation,
  buildRunEvent,
  type RunEventTargetKind,
  type NormalizedSemanticTarget,
  type SemanticTarget,
  normalizeSemanticTarget,
  semanticLocatorExpression,
} from "../../../domain/interaction/model.js";
import { ActionFailure } from "../../../domain/interaction/action-failure.js";
import {
  InteractionErrorCode,
  refStaleFailure,
  modalStateBlockedFailure,
} from "../../../domain/interaction/errors.js";
import { appendRunEvent, ensureRunDir } from "../../fs/run-artifacts.js";
import { runManagedSessionCommand } from "../cli-client.js";
import { parseDownloadEvent, parsePageSummary, stripQuotes } from "../output-parsers.js";
import {
  throwIfManagedActionError,
  throwManagedActionErrorText,
} from "./action-failure-classifier.js";
import { managedRunCode, managedSnapshot } from "./code.js";
import { buildDiagnosticsDelta, captureDiagnosticsBaseline } from "./diagnostics.js";
import { isModalStateBlockedMessage, maybeRawOutput, normalizeRef } from "./shared.js";
import { managedPageCurrent, pageIdRuntimePrelude } from "./workspace.js";

type SelectorTarget = {
  selector: string;
  nth?: number;
};

async function recordRun(
  command: string,
  sessionName: string | undefined,
  page: Record<string, unknown> | undefined,
  details: Record<string, unknown>,
  targetKind?: RunEventTargetKind,
) {
  const run = await ensureRunDir(sessionName);
  const event = buildRunEvent(command, sessionName, page, details, targetKind ?? "none");
  await appendRunEvent(run.runDir, event);
  return run;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function errorCode(error: unknown, fallback: string) {
  return error instanceof ActionFailure ? error.code : fallback;
}

function errorRetryable(error: unknown) {
  return error instanceof ActionFailure ? error.retryable : undefined;
}

function errorSuggestions(error: unknown) {
  return error instanceof ActionFailure ? error.suggestions : undefined;
}

function errorDetails(error: unknown) {
  return error instanceof ActionFailure ? error.details : undefined;
}

async function buildDiagnosticsDeltaOrSignal(
  sessionName: string | undefined,
  before: { consoleTotal: number; networkTotal: number; pageErrorTotal: number },
) {
  try {
    return await buildDiagnosticsDelta(sessionName, before);
  } catch (error) {
    return {
      unavailable: true,
      reason: errorMessage(error),
    };
  }
}

function attachFailureRun(error: unknown, run: Awaited<ReturnType<typeof recordRun>>) {
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

function isModalBlockedDelta(delta: Record<string, unknown>) {
  return delta.unavailable === true && isModalStateBlockedMessage(errorMessage(delta.reason));
}

async function recordFailedRun(
  command: string,
  sessionName: string | undefined,
  page: Record<string, unknown> | undefined,
  before: { consoleTotal: number; networkTotal: number; pageErrorTotal: number },
  error: unknown,
  details: Record<string, unknown> = {},
) {
  const diagnosticsDelta = await buildDiagnosticsDeltaOrSignal(sessionName, before);
  const run = await recordRun(command, sessionName, page, {
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

async function managedActionRunCode(options: {
  command: string;
  sessionName?: string;
  source: string;
}) {
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

async function managedActionRunCodeWithFailureRun(options: {
  command: string;
  sessionName?: string;
  source: string;
  before: { consoleTotal: number; networkTotal: number; pageErrorTotal: number };
  target?: Record<string, unknown>;
  details?: Record<string, unknown>;
}) {
  try {
    return await managedActionRunCode({
      command: options.command,
      sessionName: options.sessionName,
      source: options.source,
    });
  } catch (error) {
    await recordFailedRun(options.command, options.sessionName, undefined, options.before, error, {
      ...(options.target ? { target: options.target } : {}),
      ...(options.details ?? {}),
    });
    throw error;
  }
}

async function throwIfManagedActionErrorWithFailureRun(
  text: string,
  context: { command: string; sessionName?: string },
  options: {
    before: { consoleTotal: number; networkTotal: number; pageErrorTotal: number };
    page?: Record<string, unknown>;
    target?: Record<string, unknown>;
    details?: Record<string, unknown>;
  },
) {
  try {
    throwIfManagedActionError(text, context);
  } catch (error) {
    await recordFailedRun(
      context.command,
      context.sessionName,
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

function dialogPendingResult(options: {
  command: string;
  sessionName?: string;
  resultText?: string;
  page?: Record<string, unknown>;
  target?: Record<string, unknown>;
  before: { consoleTotal: number; networkTotal: number; pageErrorTotal: number };
  diagnosticsDelta?: Record<string, unknown>;
}) {
  return (async () => {
    const diagnosticsDelta =
      options.diagnosticsDelta ??
      (await buildDiagnosticsDeltaOrSignal(options.sessionName, options.before));
    const run = await recordRun(options.command, options.sessionName, options.page, {
      ...(options.target ? { target: options.target } : {}),
      status: "dialog-pending",
      acted: true,
      modalPending: true,
      diagnosticsDelta,
      failureSignal: {
        code: modalStateBlockedFailure("", { command: options.command, sessionName: options.sessionName }).code,
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
        blockedState: InteractionErrorCode.MODAL_STATE_BLOCKED,
        diagnosticsDelta,
        run,
        ...(options.resultText ? maybeRawOutput(options.resultText) : {}),
      },
    };
  })();
}

async function validateRefEpoch(options: {
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

async function assertFreshRefEpoch(options: { sessionName?: string; ref: string }) {
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
  throw refStaleFailure(
    `Ref ${options.ref} is stale for the current page snapshot`,
    {
      command: "assertFreshRefEpoch",
      sessionName: options.sessionName,
      ref: options.ref,
    },
    {
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
            snapshotPageId: (validation as Record<string, unknown>).snapshotPageId ?? null,
            snapshotNavigationId: (validation as Record<string, unknown>).snapshotNavigationId ?? null,
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
    },
  );
}

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

  const before = await captureDiagnosticsBaseline(options.sessionName);

  if (options.semantic) {
    const target = normalizeSemanticTarget(options.semantic);
    let result: Awaited<ReturnType<typeof managedActionRunCode>>;
    try {
      result = await managedActionRunCode({
        command: "click",
        sessionName: options.sessionName,
        source: semanticClickSource(target, options.button),
      });
    } catch (error) {
      if (isModalStateBlockedMessage(errorMessage(error))) {
        return dialogPendingResult({
          command: "click",
          sessionName: options.sessionName,
          target,
          before,
        });
      }
      await recordFailedRun("click", options.sessionName, undefined, before, error, { target });
      throw error;
    }
    const diagnosticsDelta = await buildDiagnosticsDeltaOrSignal(options.sessionName, before);
    if (isModalBlockedDelta(diagnosticsDelta)) {
      return dialogPendingResult({
        command: "click",
        sessionName: options.sessionName,
        page: result.page,
        target,
        before,
        diagnosticsDelta,
      });
    }
    const run = await recordRun("click", options.sessionName, result.page, {
      target,
      diagnosticsDelta,
    }, "semantic");
    return {
      session: result.session,
      page: result.page,
      data: {
        target,
        acted: true,
        diagnosticsDelta,
        run,
      },
    };
  }

  if (options.selector) {
    const target = normalizeSelectorTarget({ selector: options.selector, nth: options.nth });
    const clickOptions = options.button ? JSON.stringify({ button: options.button }) : "undefined";
    let result: Awaited<ReturnType<typeof managedActionRunCode>>;
    try {
      result = await managedActionRunCode({
        command: "click",
        sessionName: options.sessionName,
        source: selectorActionSource("CLICK", target, (locator) => {
          return `await ${locator}.click(${clickOptions});`;
        }),
      });
    } catch (error) {
      if (isModalStateBlockedMessage(errorMessage(error))) {
        return dialogPendingResult({
          command: "click",
          sessionName: options.sessionName,
          target,
          before,
        });
      }
      await recordFailedRun("click", options.sessionName, undefined, before, error, { target });
      throw error;
    }
    const diagnosticsDelta = await buildDiagnosticsDeltaOrSignal(options.sessionName, before);
    if (isModalBlockedDelta(diagnosticsDelta)) {
      return dialogPendingResult({
        command: "click",
        sessionName: options.sessionName,
        page: result.page,
        target,
        before,
        diagnosticsDelta,
      });
    }
    const run = await recordRun("click", options.sessionName, result.page, {
      target,
      diagnosticsDelta,
    }, "selector");
    return {
      session: result.session,
      page: result.page,
      data: {
        target,
        selector: options.selector,
        nth: target.nth,
        ...(options.button ? { button: options.button } : {}),
        acted: true,
        diagnosticsDelta,
        run,
      },
    };
  }

  const ref = normalizeRef(options.ref ?? "");
  await assertFreshRefEpoch({ sessionName: options.sessionName, ref });
  const args = ["click", ref];
  if (options.button) {
    args.push(options.button);
  }

  const result = await runManagedSessionCommand(
    {
      _: args,
    },
    {
      sessionName: options.sessionName,
    },
  );
  const page = parsePageSummary(result.text);
  try {
    throwIfManagedActionError(result.text, { command: "click", sessionName: options.sessionName });
  } catch (error) {
    if (isModalStateBlockedMessage(errorMessage(error))) {
      return dialogPendingResult({
        command: "click",
        sessionName: result.sessionName,
        resultText: result.text,
        page,
        target: { ref },
        before,
      });
    }
    await recordFailedRun("click", result.sessionName, page, before, error, { target: { ref } });
    throw error;
  }

  const diagnosticsDelta = await buildDiagnosticsDeltaOrSignal(options.sessionName, before);
  if (isModalBlockedDelta(diagnosticsDelta)) {
    return dialogPendingResult({
      command: "click",
      sessionName: result.sessionName,
      resultText: result.text,
      page,
      target: { ref },
      before,
      diagnosticsDelta,
    });
  }
  const run = await recordRun("click", options.sessionName, page, {
    target: options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector },
    diagnosticsDelta,
  }, options.ref ? "ref" : "selector");
  return {
    session: {
      scope: "managed",
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page,
    data: {
      ...(options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector }),
      acted: true,
      diagnosticsDelta,
      run,
      ...maybeRawOutput(result.text),
    },
  };
}

function normalizeSelectorTarget(target: SelectorTarget) {
  return {
    selector: target.selector,
    nth: Math.max(1, Math.floor(Number(target.nth ?? 1))),
  };
}

function selectorActionSource(
  errorPrefix: string,
  target: ReturnType<typeof normalizeSelectorTarget>,
  actionSource: (locatorExpression: string) => string,
) {
  const nthIndex = target.nth - 1;
  const targetJson = JSON.stringify(target);
  const locatorExpression = `page.locator(${JSON.stringify(target.selector)})`;
  const action = actionSource(`locator.nth(${nthIndex})`);

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
    ${action}
    return JSON.stringify({
      acted: true,
      selected: ${errorPrefix === "SELECT" ? "true" : "undefined"},
      values: typeof values === 'undefined' ? undefined : values,
      target,
      count,
      nth: ${target.nth},
    });
  }`;
}

function semanticClickSource(target: NormalizedSemanticTarget, button?: string) {
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
    await locator.nth(${nthIndex}).click(${clickOptions});
    return JSON.stringify({ clicked: true, target, count, nth: ${target.nth} });
  }`;
}

function semanticBooleanControlSource(
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

function semanticInputSource(
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

  const before = await captureDiagnosticsBaseline(options.sessionName);

  if (options.semantic) {
    const target = normalizeSemanticTarget(options.semantic);
    const result = await managedActionRunCodeWithFailureRun({
      command: "fill",
      sessionName: options.sessionName,
      source: semanticInputSource("FILL", target, "fill", options.value),
      before,
      target,
    });

    const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
    const run = await recordRun("fill", options.sessionName, result.page, {
      target,
      diagnosticsDelta,
    }, "semantic");
    return {
      session: result.session,
      page: result.page,
      data: {
        target,
        value: options.value,
        filled: true,
        diagnosticsDelta,
        run,
      },
    };
  }

  if (options.selector) {
    const target = normalizeSelectorTarget({ selector: options.selector, nth: options.nth });
    const result = await managedActionRunCodeWithFailureRun({
      command: "fill",
      sessionName: options.sessionName,
      source: selectorActionSource("FILL", target, (locator) => {
        return `await ${locator}.fill(${JSON.stringify(options.value)});`;
      }),
      before,
      target,
    });
    const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
    const run = await recordRun("fill", options.sessionName, result.page, {
      target,
      diagnosticsDelta,
    }, "selector");
    return {
      session: result.session,
      page: result.page,
      data: {
        target,
        selector: options.selector,
        nth: target.nth,
        value: options.value,
        filled: true,
        diagnosticsDelta,
        run,
      },
    };
  }

  await assertFreshRefEpoch({
    sessionName: options.sessionName,
    ref: normalizeRef(options.ref ?? ""),
  });
  const result = await runManagedSessionCommand(
    {
      _: ["fill", normalizeRef(options.ref ?? ""), options.value],
    },
    {
      sessionName: options.sessionName,
    },
  );
  const fillPage = parsePageSummary(result.text);
  await throwIfManagedActionErrorWithFailureRun(
    result.text,
    { command: "fill", sessionName: options.sessionName },
    { before, page: fillPage, target: { ref: normalizeRef(options.ref ?? "") } },
  );

  const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
  const run = await recordRun("fill", options.sessionName, fillPage, {
    target: options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector },
    diagnosticsDelta,
  }, options.ref ? "ref" : "selector");
  return {
    session: {
      scope: "managed",
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page: fillPage,
    data: {
      ...(options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector }),
      value: options.value,
      filled: true,
      diagnosticsDelta,
      run,
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedType(options: {
  ref?: string;
  selector?: string;
  nth?: number;
  semantic?: SemanticTarget;
  value: string;
  sessionName?: string;
}) {
  const before = await captureDiagnosticsBaseline(options.sessionName);

  if (options.semantic) {
    const target = normalizeSemanticTarget(options.semantic);
    const result = await managedActionRunCodeWithFailureRun({
      command: "type",
      sessionName: options.sessionName,
      source: semanticInputSource("TYPE", target, "type", options.value),
      before,
      target,
    });

    const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
    const run = await recordRun("type", options.sessionName, result.page, {
      target,
      diagnosticsDelta,
    }, "semantic");
    return {
      session: result.session,
      page: result.page,
      data: {
        target,
        value: options.value,
        typed: true,
        diagnosticsDelta,
        run,
      },
    };
  }

  if (!options.ref && !options.selector) {
    const result = await runManagedSessionCommand(
      {
        _: ["type", options.value],
      },
      {
        sessionName: options.sessionName,
      },
    );
    const page = parsePageSummary(result.text);
    await throwIfManagedActionErrorWithFailureRun(
      result.text,
      { command: "type", sessionName: options.sessionName },
      { before, page },
    );
    const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
    const run = await recordRun("type", options.sessionName, page, {
      diagnosticsDelta,
    }, "none");
    return {
      session: {
        scope: "managed",
        name: result.sessionName,
        default: result.sessionName === "default",
      },
      page,
      data: {
        value: options.value,
        typed: true,
        diagnosticsDelta,
        run,
        ...maybeRawOutput(result.text),
      },
    };
  }

  const target = options.ref ? normalizeRef(options.ref) : options.selector;
  if (options.ref) {
    await assertFreshRefEpoch({ sessionName: options.sessionName, ref: target ?? "" });
  }
  const selectorTarget = options.selector
    ? normalizeSelectorTarget({ selector: options.selector, nth: options.nth })
    : undefined;
  const source = options.ref
    ? `async page => { await page.locator(${JSON.stringify(`aria-ref=${target}`)}).type(${JSON.stringify(options.value)}); return 'typed'; }`
    : selectorActionSource(
        "TYPE",
        selectorTarget as ReturnType<typeof normalizeSelectorTarget>,
        (locator) => {
          return `await ${locator}.type(${JSON.stringify(options.value)});`;
        },
      );

  const result = await managedActionRunCodeWithFailureRun({
    command: "type",
    source,
    sessionName: options.sessionName,
    before,
    target: options.ref ? { ref: normalizeRef(options.ref) } : selectorTarget,
  });
  const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
  const run = await recordRun("type", options.sessionName, result.page, {
    target: options.ref ? { ref: normalizeRef(options.ref) } : selectorTarget,
    diagnosticsDelta,
  }, options.ref ? "ref" : "selector");
  return {
    session: result.session,
    page: result.page,
    data: {
      ...(options.ref
        ? { ref: normalizeRef(options.ref) }
        : { target: selectorTarget, selector: options.selector, nth: selectorTarget?.nth }),
      value: options.value,
      typed: true,
      diagnosticsDelta,
      run,
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

export async function managedPress(key: string, options?: { sessionName?: string }) {
  const before = await captureDiagnosticsBaseline(options?.sessionName);
  const result = await runManagedSessionCommand(
    {
      _: ["press", key],
    },
    {
      sessionName: options?.sessionName,
    },
  );
  const page = parsePageSummary(result.text);
  await throwIfManagedActionErrorWithFailureRun(
    result.text,
    { command: "press", sessionName: options?.sessionName },
    { before, page, details: { key } },
  );

  const diagnosticsDelta = await buildDiagnosticsDelta(options?.sessionName, before);
  const run = await recordRun("press", options?.sessionName, page, {
    key,
    diagnosticsDelta,
  });
  return {
    session: {
      scope: "managed",
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page,
    data: {
      key,
      pressed: true,
      diagnosticsDelta,
      run,
      ...maybeRawOutput(result.text),
    },
  };
}

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

  const before = await captureDiagnosticsBaseline(options.sessionName);

  if (options.semantic) {
    const target = normalizeSemanticTarget(options.semantic);
    const result = await managedActionRunCodeWithFailureRun({
      command,
      sessionName: options.sessionName,
      source: semanticBooleanControlSource(command, target),
      before,
      target,
    });
    const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
    const run = await recordRun(command, options.sessionName, result.page, {
      target,
      diagnosticsDelta,
    }, "semantic");
    return {
      session: result.session,
      page: result.page,
      data: {
        target,
        acted: true,
        checked: command === "check",
        diagnosticsDelta,
        run,
      },
    };
  }

  if (options.selector) {
    const target = normalizeSelectorTarget({ selector: options.selector, nth: options.nth });
    const result = await managedActionRunCodeWithFailureRun({
      command,
      sessionName: options.sessionName,
      source: selectorActionSource(command.toUpperCase(), target, (locator) => {
        return `await ${locator}.${command}();`;
      }),
      before,
      target,
    });
    const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
    const run = await recordRun(command, options.sessionName, result.page, {
      target,
      diagnosticsDelta,
    }, "selector");
    return {
      session: result.session,
      page: result.page,
      data: {
        target,
        selector: options.selector,
        nth: target.nth,
        acted: true,
        checked: command === "check",
        diagnosticsDelta,
        run,
      },
    };
  }

  const ref = normalizeRef(options.ref ?? "");
  await assertFreshRefEpoch({ sessionName: options.sessionName, ref });
  const result = await runManagedSessionCommand(
    {
      _: [command, ref],
    },
    {
      sessionName: options.sessionName,
    },
  );
  const page = parsePageSummary(result.text);
  await throwIfManagedActionErrorWithFailureRun(
    result.text,
    { command, sessionName: options.sessionName },
    { before, page, target: { ref } },
  );

  const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
  const run = await recordRun(command, options.sessionName, page, {
    target: { ref },
    diagnosticsDelta,
  }, "ref");
  return {
    session: {
      scope: "managed",
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page,
    data: {
      ref,
      acted: true,
      checked: command === "check",
      diagnosticsDelta,
      run,
      ...maybeRawOutput(result.text),
    },
  };
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

  const before = await captureDiagnosticsBaseline(options.sessionName);

  if (options.semantic) {
    const target = normalizeSemanticTarget(options.semantic);
    const nthIndex = target.nth - 1;
    const targetJson = JSON.stringify(target);
    const locatorExpression = semanticLocatorExpression(target);

    const source = `async page => {
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

    const result = await managedActionRunCodeWithFailureRun({
      command: "hover",
      sessionName: options.sessionName,
      source,
      before,
      target,
    });
    const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
    const run = await recordRun("hover", options.sessionName, result.page, {
      target,
      diagnosticsDelta,
    }, "semantic");
    return {
      session: result.session,
      page: result.page,
      data: {
        target,
        acted: true,
        diagnosticsDelta,
        run,
      },
    };
  }

  if (options.selector) {
    const target = normalizeSelectorTarget({ selector: options.selector, nth: options.nth });
    const result = await managedActionRunCodeWithFailureRun({
      command: "hover",
      sessionName: options.sessionName,
      source: selectorActionSource("HOVER", target, (locator) => {
        return `await ${locator}.hover();`;
      }),
      before,
      target,
    });
    const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
    const run = await recordRun("hover", options.sessionName, result.page, {
      target,
      diagnosticsDelta,
    }, "selector");
    return {
      session: result.session,
      page: result.page,
      data: {
        target,
        selector: options.selector,
        nth: target.nth,
        acted: true,
        diagnosticsDelta,
        run,
      },
    };
  }

  const ref = normalizeRef(options.ref ?? "");
  await assertFreshRefEpoch({ sessionName: options.sessionName, ref });
  const result = await runManagedSessionCommand(
    {
      _: ["hover", ref],
    },
    {
      sessionName: options.sessionName,
    },
  );
  const page = parsePageSummary(result.text);
  await throwIfManagedActionErrorWithFailureRun(
    result.text,
    { command: "hover", sessionName: options.sessionName },
    { before, page, target: { ref } },
  );

  const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
  const run = await recordRun("hover", options.sessionName, page, {
    target: { ref },
    diagnosticsDelta,
  }, "ref");
  return {
    session: {
      scope: "managed",
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page,
    data: {
      ref,
      acted: true,
      diagnosticsDelta,
      run,
      ...maybeRawOutput(result.text),
    },
  };
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

  const before = await captureDiagnosticsBaseline(options.sessionName);

  if (options.semantic) {
    const target = normalizeSemanticTarget(options.semantic);
    const nthIndex = target.nth - 1;
    const targetJson = JSON.stringify(target);
    const locatorExpression = semanticLocatorExpression(target);
    const valueJson = JSON.stringify(options.value);

    const source = `async page => {
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

    const result = await managedActionRunCodeWithFailureRun({
      command: "select",
      sessionName: options.sessionName,
      source,
      before,
      target,
      details: { value: options.value },
    });
    const parsed =
      typeof result.data.result === "object" && result.data.result ? result.data.result : {};
    const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
    const run = await recordRun("select", options.sessionName, result.page, {
      target,
      value: options.value,
      diagnosticsDelta,
    }, "semantic");
    return {
      session: result.session,
      page: result.page,
      data: {
        target,
        value: options.value,
        values: Array.isArray(parsed.values) ? parsed.values : [options.value],
        selected: true,
        diagnosticsDelta,
        run,
      },
    };
  }

  if (options.selector) {
    const target = normalizeSelectorTarget({ selector: options.selector, nth: options.nth });
    const result = await managedActionRunCodeWithFailureRun({
      command: "select",
      sessionName: options.sessionName,
      source: selectorActionSource("SELECT", target, (locator) => {
        return `const values = await ${locator}.selectOption(${JSON.stringify(options.value)});`;
      }),
      before,
      target,
      details: { value: options.value },
    });
    const parsed =
      typeof result.data.result === "object" && result.data.result ? result.data.result : {};
    const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
    const run = await recordRun("select", options.sessionName, result.page, {
      target,
      value: options.value,
      diagnosticsDelta,
    }, "selector");
    return {
      session: result.session,
      page: result.page,
      data: {
        target,
        selector: options.selector,
        nth: target.nth,
        value: options.value,
        values: Array.isArray(parsed.values) ? parsed.values : [options.value],
        selected: true,
        diagnosticsDelta,
        run,
      },
    };
  }

  const ref = normalizeRef(options.ref ?? "");
  await assertFreshRefEpoch({ sessionName: options.sessionName, ref });
  const result = await runManagedSessionCommand(
    {
      _: ["select", ref, options.value],
    },
    {
      sessionName: options.sessionName,
    },
  );
  const page = parsePageSummary(result.text);
  await throwIfManagedActionErrorWithFailureRun(
    result.text,
    { command: "select", sessionName: options.sessionName },
    { before, page, target: { ref }, details: { value: options.value } },
  );

  const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
  const run = await recordRun("select", options.sessionName, page, {
    target: { ref },
    value: options.value,
    diagnosticsDelta,
  }, "ref");
  return {
    session: {
      scope: "managed",
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page,
    data: {
      ref,
      value: options.value,
      selected: true,
      diagnosticsDelta,
      run,
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedDialog(
  action: "accept" | "dismiss",
  options?: { prompt?: string; sessionName?: string },
) {
  const command = action === "accept" ? "dialog-accept" : "dialog-dismiss";
  const argv = action === "accept" && options?.prompt ? [command, options.prompt] : [command];
  const result = await runManagedSessionCommand(
    {
      _: argv,
    },
    {
      sessionName: options?.sessionName,
    },
  );
  throwIfManagedActionError(result.text, { command: "dialog", sessionName: options?.sessionName });

  return {
    session: {
      scope: "managed",
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page: parsePageSummary(result.text),
    data: {
      action,
      handled: true,
      ...(options?.prompt ? { prompt: options.prompt } : {}),
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedScroll(options: {
  direction: "up" | "down" | "left" | "right";
  distance?: number;
  sessionName?: string;
}) {
  const distance = options.distance ?? 500;
  const delta = {
    up: [0, -distance],
    down: [0, distance],
    left: [-distance, 0],
    right: [distance, 0],
  }[options.direction];

  const before = await captureDiagnosticsBaseline(options.sessionName);
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      await page.mouse.wheel(${delta[0]}, ${delta[1]});
      return JSON.stringify({ direction: ${JSON.stringify(options.direction)}, distance: ${distance} });
    }`,
  });

  const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
  const run = await recordRun("scroll", options.sessionName, result.page, {
    direction: options.direction,
    distance,
    diagnosticsDelta,
  }, "none");
  return {
    session: result.session,
    page: result.page,
    data: {
      direction: options.direction,
      distance,
      scrolled: true,
      diagnosticsDelta,
      run,
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

export async function managedScreenshot(options?: {
  ref?: string;
  selector?: string;
  path?: string;
  fullPage?: boolean;
  sessionName?: string;
}) {
  if (options?.ref) {
    await assertFreshRefEpoch({ sessionName: options.sessionName, ref: normalizeRef(options.ref) });
  }
  const run = await ensureRunDir(options?.sessionName);
  const defaultPath = join(run.runDir, `screenshot-${Date.now()}.png`);
  const target = options?.ref
    ? `page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.ref)}`)})`
    : options?.selector
      ? `page.locator(${JSON.stringify(options.selector)})`
      : "page";
  const method = options?.ref || options?.selector ? "screenshot" : "screenshot";
  const source = `async page => {
    const target = ${target};
    await target.${method}(${JSON.stringify({
      path: options?.path ?? defaultPath,
      ...(options?.fullPage && !options?.ref && !options?.selector ? { fullPage: true } : {}),
    })});
    return JSON.stringify({
      path: ${JSON.stringify(options?.path ?? defaultPath)},
      ${options?.ref ? `ref: ${JSON.stringify(normalizeRef(options.ref))},` : ""}
      ${options?.selector ? `selector: ${JSON.stringify(options.selector)},` : ""}
      ${options?.fullPage ? "fullPage: true," : ""}
    });
  }`;

  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};
  const pageMeta =
    result.page && typeof result.page === "object"
      ? (result.page as Record<string, unknown>)
      : undefined;
  await appendRunEvent(run.runDir, {
    ts: new Date().toISOString(),
    command: "screenshot",
    sessionName: options?.sessionName ?? null,
    pageId: typeof pageMeta?.pageId === "string" ? pageMeta.pageId : null,
    navigationId: typeof pageMeta?.navigationId === "string" ? pageMeta.navigationId : null,
    path: parsed.path ?? options?.path ?? defaultPath,
    ref: parsed.ref ?? null,
    selector: parsed.selector ?? null,
    fullPage: Boolean(parsed.fullPage),
  });
  return {
    session: result.session,
    page: result.page,
    data: {
      ...parsed,
      run,
      captured: true,
    },
  };
}

export async function managedPdf(options: { path: string; sessionName?: string }) {
  const path = resolve(options.path);
  await mkdir(dirname(path), { recursive: true });
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      await page.pdf({ path: ${JSON.stringify(path)} });
      return JSON.stringify({
        path: ${JSON.stringify(path)},
        saved: true,
        url: page.url(),
      });
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};
  const run = await recordRun("pdf", options.sessionName, result.page, {
    path,
    url: typeof parsed.url === "string" ? parsed.url : undefined,
  }, "none");
  return {
    session: result.session,
    page: result.page,
    data: {
      path,
      saved: true,
      url: parsed.url ?? result.page?.url,
      run,
    },
  };
}

export async function managedUpload(options: {
  ref?: string;
  selector?: string;
  files: string[];
  sessionName?: string;
}) {
  if (!options.ref && !options.selector) {
    throw new Error("upload requires a ref or selector");
  }
  if (options.ref) {
    await assertFreshRefEpoch({ sessionName: options.sessionName, ref: normalizeRef(options.ref) });
  }
  const resolvedFiles = options.files.map((file) => resolve(file));
  const files = resolvedFiles.map((file) => JSON.stringify(file)).join(", ");
  const target = options.ref
    ? `page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.ref)}`)})`
    : `page.locator(${JSON.stringify(options.selector)})`;
  const uploadSignalToken = `pwcli-upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const before = await captureDiagnosticsBaseline(options.sessionName);
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      const locator = ${target};
      const token = ${JSON.stringify(uploadSignalToken)};
      await locator.evaluate((element, token) => {
        const win = element.ownerDocument.defaultView;
        if (!win)
          return;
        const state = win.__pwcliUploadSignals ||= {};
        state[token] = { changeObserved: false, inputObserved: false };
        element.addEventListener('change', () => {
          state[token].changeObserved = true;
        }, { once: true });
        element.addEventListener('input', () => {
          state[token].inputObserved = true;
        }, { once: true });
      }, token);
      await locator.setInputFiles([${files}]);
      await page.waitForFunction(token => {
        const state = window.__pwcliUploadSignals?.[token];
        return Boolean(state?.changeObserved || state?.inputObserved);
      }, token, { timeout: 750 }).catch(() => null);
      const settle = await locator.evaluate((element, payload) => {
        const input = element instanceof HTMLInputElement
          ? element
          : element.querySelector('input[type="file"]');
        const state = element.ownerDocument.defaultView?.__pwcliUploadSignals?.[payload.token] ?? {};
        const fileCount = input?.files?.length ?? null;
        const fileNames = input?.files ? Array.from(input.files).map(file => file.name) : [];
        return {
          fileCount,
          fileNames,
          expectedCount: payload.expectedCount,
          changeObserved: Boolean(state.changeObserved),
          inputObserved: Boolean(state.inputObserved),
          filesMatch: fileCount === payload.expectedCount,
        };
      }, { token, expectedCount: ${resolvedFiles.length} });
      const settled = Boolean(settle.filesMatch && (settle.changeObserved || settle.inputObserved));
      return JSON.stringify({
        uploaded: true,
        settle: { ...settle, settled },
        nextSteps: settled ? [] : [
          'Run \`pw wait --session <name> --selector <uploaded-state-selector>\` or \`pw wait --session <name> --response <upload-api>\`',
          'Verify the page accepted the upload with \`pw verify\`, \`pw get\`, or \`pw read-text\`, then retry if needed',
        ],
      });
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};
  const settle =
    "settle" in parsed && parsed.settle && typeof parsed.settle === "object"
      ? (parsed.settle as Record<string, unknown>)
      : {
          settled: false,
          fileCount: null,
          expectedCount: resolvedFiles.length,
          changeObserved: false,
          inputObserved: false,
          filesMatch: false,
        };
  const nextSteps = Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [];
  const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
  const run = await recordRun("upload", options.sessionName, result.page, {
    target: options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector },
    files: resolvedFiles,
    settle,
    nextSteps,
    diagnosticsDelta,
  }, options.ref ? "ref" : "selector");
  return {
    session: result.session,
    page: result.page,
    data: {
      ...(options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector }),
      files: resolvedFiles,
      uploaded: true,
      settle,
      ...(nextSteps.length > 0 ? { nextSteps } : {}),
      diagnosticsDelta,
      run,
    },
  };
}

export async function managedDrag(options: {
  fromRef?: string;
  toRef?: string;
  fromSelector?: string;
  toSelector?: string;
  sessionName?: string;
}) {
  if ((!options.fromRef && !options.fromSelector) || (!options.toRef && !options.toSelector)) {
    throw new Error("drag requires source and target");
  }
  if (options.fromRef) {
    await assertFreshRefEpoch({
      sessionName: options.sessionName,
      ref: normalizeRef(options.fromRef),
    });
  }
  if (options.toRef) {
    await assertFreshRefEpoch({
      sessionName: options.sessionName,
      ref: normalizeRef(options.toRef),
    });
  }
  const source = options.fromRef
    ? `page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.fromRef)}`)})`
    : `page.locator(${JSON.stringify(options.fromSelector)})`;
  const target = options.toRef
    ? `page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.toRef)}`)})`
    : `page.locator(${JSON.stringify(options.toSelector)})`;

  const before = await captureDiagnosticsBaseline(options.sessionName);
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      await ${source}.dragTo(${target});
      return JSON.stringify({ dragged: true });
    }`,
  });

  const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
  const run = await recordRun("drag", options.sessionName, result.page, {
    diagnosticsDelta,
  }, options.fromRef || options.toRef ? "ref" : "selector");
  return {
    session: result.session,
    page: result.page,
    data: {
      ...(options.fromRef
        ? { fromRef: normalizeRef(options.fromRef) }
        : { fromSelector: options.fromSelector }),
      ...(options.toRef
        ? { toRef: normalizeRef(options.toRef) }
        : { toSelector: options.toSelector }),
      dragged: true,
      diagnosticsDelta,
      run,
    },
  };
}

export async function managedDownload(options: {
  ref?: string;
  selector?: string;
  path?: string;
  dir?: string;
  sessionName?: string;
}) {
  if (!options.ref && !options.selector) {
    throw new Error("download requires a ref or selector");
  }
  if (options.ref) {
    await assertFreshRefEpoch({ sessionName: options.sessionName, ref: normalizeRef(options.ref) });
  }
  const target = options.ref
    ? `page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.ref)}`)})`
    : `page.locator(${JSON.stringify(options.selector)})`;

  const run = await ensureRunDir(options.sessionName);
  const dir = options.dir ? resolve(options.dir) : undefined;
  const exactPath = options.path ? resolve(options.path) : undefined;
  if (dir) {
    await mkdir(dir, { recursive: true });
  }
  if (exactPath) {
    await mkdir(dirname(exactPath), { recursive: true });
  }

  const before = await captureDiagnosticsBaseline(options.sessionName);
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      await ${target}.click();
      return 'clicked';
    }`,
  });
  const downloadEvent = parseDownloadEvent(result.rawText ?? "");
  if (!downloadEvent) {
    throw new Error("No download event captured");
  }
  const sourcePath = resolve(downloadEvent.outputPath);
  const savedAs = dir
    ? join(dir, downloadEvent.suggestedFilename)
    : (exactPath ?? join(run.runDir, downloadEvent.suggestedFilename));
  if (savedAs) {
    await copyFile(sourcePath, savedAs);
  }
  const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
  await appendRunEvent(run.runDir, {
    ts: new Date().toISOString(),
    command: "download",
    sessionName: options.sessionName ?? null,
    suggestedFilename: downloadEvent.suggestedFilename,
    sourcePath,
    savedAs,
    diagnosticsDelta,
  });

  return {
    session: result.session,
    page: result.page,
    data: {
      ...(options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector }),
      ...(dir ? { dir } : {}),
      ...(exactPath ? { requestedPath: exactPath } : {}),
      suggestedFilename: downloadEvent.suggestedFilename,
      sourcePath,
      ...(savedAs ? { savedAs } : {}),
      downloaded: true,
      diagnosticsDelta,
      run,
    },
  };
}

export async function managedReadText(options?: {
  selector?: string;
  includeOverlay?: boolean;
  maxChars?: number;
  sessionName?: string;
}) {
  const source = options?.selector
    ? `async page => {
      const sel = ${JSON.stringify(options.selector)};
      const locator = page.locator(sel);
      const count = await locator.count();
      if (count === 0) {
        throw new Error('READ_TEXT_SELECTOR_NOT_FOUND:' + JSON.stringify({ selector: sel }));
      }
      const text = await locator.first().textContent() ?? '';
      return JSON.stringify({ source: 'selector', selector: sel, text, count });
    }`
    : `async page => {
      const includeOverlay = ${JSON.stringify(options?.includeOverlay !== false)};
      const data = await page.evaluate((includeOverlay) => {
        const skipTags = new Set(['STYLE', 'SCRIPT', 'NOSCRIPT', 'SVG', 'MATH', 'TEMPLATE']);
        const walkText = (root) => {
          let result = '';
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const node = walker.currentNode;
            const parent = node.parentElement;
            if (!parent) continue;
            if (skipTags.has(parent.tagName)) continue;
            const style = getComputedStyle(parent);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
            const t = node.textContent?.trim();
            if (t) result += t + ' ';
          }
          for (const el of root.querySelectorAll('*')) {
            if (el.shadowRoot) result += walkText(el.shadowRoot);
          }
          return result;
        };
        const bodyText = walkText(document.body).replace(/\\s+/g, ' ').trim();
        let overlays = [];
        if (includeOverlay) {
          const visible = (el) => {
            if (!(el instanceof HTMLElement))
              return false;
            const style = window.getComputedStyle(el);
            if (
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              style.opacity === '0' ||
              el.getAttribute('aria-hidden') === 'true'
            )
              return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          };
          const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
          const overlaySelectors = [
            '[role="dialog"]',
            '[role="menu"]',
            '[role="listbox"]',
            '[role="tooltip"]',
            '[role="alertdialog"]',
            '[aria-modal="true"]',
            '.modal',
            '.dropdown',
            '.popover',
            '.tooltip',
            '.ant-modal',
            '.ant-dropdown',
            '.ant-select-dropdown',
            '.ant-popover',
            '.ant-tooltip',
            '.el-popper',
            '.el-dropdown-menu',
          ];
          overlays = Array.from(document.querySelectorAll(overlaySelectors.join(',')))
              .filter(visible)
              .map((el) => ({
                selector: overlaySelectors.find((selector) => el.matches(selector)) || '',
                text: normalize(el.innerText || el.textContent || ''),
              }))
              .filter((item) => item.text);
        }
        return {
          source: includeOverlay ? 'body-visible+overlay' : 'body-visible',
          text: bodyText,
          overlays,
        };
      }, includeOverlay);
      return JSON.stringify(data);
    }`;

  const result = await managedRunCode({ source, sessionName: options?.sessionName });
  const parsed = result.data.result || {};
  const rawText = parsed.text ?? "";
  const text =
    options?.maxChars !== undefined && rawText.length > options.maxChars
      ? rawText.slice(0, options.maxChars)
      : rawText;

  return {
    session: result.session,
    page: result.page,
    data: {
      ...parsed,
      text,
      truncated: text.length !== rawText.length,
      charCount: text.length,
      totalCharCount: rawText.length,
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

export async function managedWait(options: {
  target?: string;
  text?: string;
  selector?: string;
  networkidle?: boolean;
  request?: string;
  response?: string;
  method?: string;
  status?: string;
  sessionName?: string;
}) {
  let source = "";
  let condition: Record<string, unknown> | string = "";

  if (options.target && /^\d+$/.test(options.target)) {
    condition = { kind: "delay", timeoutMs: Number(options.target) };
    source = `async page => { await page.waitForTimeout(${Number(options.target)}); return 'delay'; }`;
  } else if (options.request) {
    condition = {
      kind: "request",
      url: options.request,
      ...(options.method ? { method: options.method.toUpperCase() } : {}),
    };
    source = `async page => {
      const request = await page.waitForRequest(request => {
        if (!request.url().includes(${JSON.stringify(options.request)}))
          return false;
        ${options.method ? `if (request.method() !== ${JSON.stringify(options.method.toUpperCase())}) return false;` : ""}
        return true;
      });
      return JSON.stringify({ kind: 'request', url: request.url(), method: request.method() });
    }`;
  } else if (options.response) {
    condition = {
      kind: "response",
      url: options.response,
      ...(options.method ? { method: options.method.toUpperCase() } : {}),
      ...(options.status ? { status: options.status } : {}),
    };
    source = `async page => {
      const response = await page.waitForResponse(response => {
        if (!response.url().includes(${JSON.stringify(options.response)}))
          return false;
        ${options.method ? `if (response.request().method() !== ${JSON.stringify(options.method.toUpperCase())}) return false;` : ""}
        ${options.status ? `if (String(response.status()) !== ${JSON.stringify(options.status)}) return false;` : ""}
        return true;
      });
      return JSON.stringify({ kind: 'response', url: response.url(), method: response.request().method(), status: response.status() });
    }`;
  } else if (options.networkidle) {
    condition = { kind: "networkidle" };
    source = `async page => { await page.waitForLoadState('networkidle'); return 'networkidle'; }`;
  } else if (options.selector) {
    condition = { kind: "selector", selector: options.selector };
    source = `async page => { await page.locator(${JSON.stringify(options.selector)}).waitFor(); return 'selector'; }`;
  } else if (options.text) {
    condition = { kind: "text", text: options.text };
    source = `async page => { await page.getByText(${JSON.stringify(options.text)}, { exact: false }).waitFor(); return 'text'; }`;
  } else if (options.target) {
    condition = { kind: "ref", ref: normalizeRef(options.target) };
    source = `async page => { await page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.target)}`)}).waitFor(); return 'ref'; }`;
  } else {
    throw new Error("wait requires a condition");
  }

  const before = await captureDiagnosticsBaseline(options.sessionName);
  let result: Awaited<ReturnType<typeof managedRunCode>>;
  try {
    result = await managedRunCode({ source, sessionName: options.sessionName });
  } catch (error) {
    await recordFailedRun("wait", options.sessionName, undefined, before, error, { condition });
    throw error;
  }
  const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
  const conditionKind =
    typeof condition === "object" && "kind" in condition
      ? condition.kind === "ref"
        ? "ref"
        : condition.kind === "selector"
          ? "selector"
          : "none"
      : "none";
  const run = await recordRun("wait", options.sessionName, result.page, {
    condition,
    diagnosticsDelta,
  }, conditionKind as RunEventTargetKind);

  return {
    session: result.session,
    page: await managedPageCurrent({ sessionName: options.sessionName }).then(
      (pageResult) => pageResult.page,
    ),
    data: {
      condition:
        typeof result.data.result === "string"
          ? stripQuotes(result.data.result)
          : typeof result.data.result === "object" && result.data.result
            ? result.data.result
            : String(result.data.result ?? ""),
      matched: true,
      diagnosticsDelta,
      run,
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}
