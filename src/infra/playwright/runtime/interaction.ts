import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  type SemanticTarget,
  type RunEventTargetKind,
  normalizeSemanticTarget,
} from "../../../domain/interaction/model.js";
import { appendRunEvent, ensureRunDir } from "../../fs/run-artifacts.js";
import { runManagedSessionCommand } from "../cli-client.js";
import { parseDownloadEvent, parsePageSummary, stripQuotes } from "../output-parsers.js";
import { managedRunCode } from "./code.js";
import { captureDiagnosticsBaseline } from "./diagnostics.js";
import { isModalStateBlockedMessage, maybeRawOutput, normalizeRef } from "./shared.js";
import { throwIfManagedActionError } from "./action-failure-classifier.js";
import { managedPageCurrent, pageIdRuntimePrelude } from "./workspace.js";
import {
  assertFreshRefEpoch,
  buildDiagnosticsDeltaOrSignal,
  buildDialogPendingResult,
  errorMessage,
  isModalBlockedDelta,
  recordFailedActionRun,
  recordActionRun,
  validateRefEpoch,
  executeCodeAction,
  executeCommandAction,
  runManagedCommand,
  finalizeAction,
  dispatchLocatorAction,
  type DiagnosticsBaseline,
} from "./action-executor.js";
import {
  selectorActionSource,
  semanticClickSource,
  semanticBooleanControlSource,
  semanticInputSource,
  semanticHoverSource,
  semanticSelectSource,
  semanticPressSource,
} from "./source-builders.js";

// Re-export for consumers that import from interaction.ts
export { assertFreshRefEpoch, validateRefEpoch };

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
  const before = await captureDiagnosticsBaseline(options.sessionName);
  const nth = Math.max(1, Math.floor(Number(options.nth ?? 1)));
  const clickOpts = options.button ? JSON.stringify({ button: options.button }) : "undefined";
  const locator = options.semantic
    ? (() => { const t = normalizeSemanticTarget(options.semantic!); return { kind: "semantic" as const, target: t, source: semanticClickSource(t, options.button) }; })()
    : options.selector
    ? { kind: "selector" as const, target: { selector: options.selector, nth }, source: selectorActionSource("CLICK", { selector: options.selector, nth }, (l) => `await ${l}.click(${clickOpts});`) }
    : { kind: "ref" as const, ref: normalizeRef(options.ref!), argv: ["click", normalizeRef(options.ref!), ...(options.button ? [options.button] : [])] };
  const tgt = "target" in locator ? locator.target as Record<string, unknown> : { ref: (locator as { ref: string }).ref };
  return dispatchLocatorAction({ command: "click", sessionName: options.sessionName, before, locator, resultData: { ...tgt, ...(options.button ? { button: options.button } : {}), acted: true }, allowModal: true });
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
  const before = await captureDiagnosticsBaseline(options.sessionName);
  const nth = Math.max(1, Math.floor(Number(options.nth ?? 1)));
  const locator = options.semantic
    ? (() => { const t = normalizeSemanticTarget(options.semantic!); return { kind: "semantic" as const, target: t, source: semanticInputSource("FILL", t, "fill", options.value) }; })()
    : options.selector
    ? { kind: "selector" as const, target: { selector: options.selector, nth }, source: selectorActionSource("FILL", { selector: options.selector, nth }, (l) => `await ${l}.fill(${JSON.stringify(options.value)});`) }
    : { kind: "ref" as const, ref: normalizeRef(options.ref!), argv: ["fill", normalizeRef(options.ref!), options.value] };
  const tgt = "target" in locator ? locator.target as Record<string, unknown> : { ref: (locator as { ref: string }).ref };
  return dispatchLocatorAction({ command: "fill", sessionName: options.sessionName, before, locator, resultData: { ...tgt, value: options.value, filled: true } });
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
  const before = await captureDiagnosticsBaseline(options.sessionName);
  const nth = Math.max(1, Math.floor(Number(options.nth ?? 1)));
  const locator = options.semantic
    ? (() => { const t = normalizeSemanticTarget(options.semantic!); return { kind: "semantic" as const, target: t, source: semanticBooleanControlSource(command, t) }; })()
    : options.selector
    ? { kind: "selector" as const, target: { selector: options.selector, nth }, source: selectorActionSource(command.toUpperCase(), { selector: options.selector, nth }, (l) => `await ${l}.${command}();`) }
    : { kind: "ref" as const, ref: normalizeRef(options.ref!), argv: [command, normalizeRef(options.ref!)] };
  const tgt = "target" in locator ? locator.target as Record<string, unknown> : { ref: (locator as { ref: string }).ref };
  return dispatchLocatorAction({ command, sessionName: options.sessionName, before, locator, resultData: { ...tgt, acted: true, checked: command === "check" } });
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
  const before = await captureDiagnosticsBaseline(options.sessionName);
  const nth = Math.max(1, Math.floor(Number(options.nth ?? 1)));
  const locator = options.semantic
    ? (() => { const t = normalizeSemanticTarget(options.semantic!); return { kind: "semantic" as const, target: t, source: semanticHoverSource(t) }; })()
    : options.selector
    ? { kind: "selector" as const, target: { selector: options.selector, nth }, source: selectorActionSource("HOVER", { selector: options.selector, nth }, (l) => `await ${l}.hover();`) }
    : { kind: "ref" as const, ref: normalizeRef(options.ref!), argv: ["hover", normalizeRef(options.ref!)] };
  const tgt = "target" in locator ? locator.target as Record<string, unknown> : { ref: (locator as { ref: string }).ref };
  return dispatchLocatorAction({ command: "hover", sessionName: options.sessionName, before, locator, resultData: { ...tgt, acted: true }, allowModal: true });
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
            (locatorHandle) => `await ${locatorHandle}.selectOption(${JSON.stringify(options.value)});`,
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

// =============================================================================
// managedDialog — no diagnostics, no recordRun; kept simple
// =============================================================================

export async function managedDialog(
  action: "accept" | "dismiss",
  options?: { prompt?: string; sessionName?: string },
) {
  const command = action === "accept" ? "dialog-accept" : "dialog-dismiss";
  const argv = action === "accept" && options?.prompt ? [command, options.prompt] : [command];
  const result = await runManagedSessionCommand(
    { _: argv },
    { sessionName: options?.sessionName },
  );
  throwIfManagedActionError(result.text, { command: "dialog", sessionName: options?.sessionName });

  return {
    session: {
      scope: "managed" as const,
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

// =============================================================================
// managedScroll
// =============================================================================

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

  const diagnosticsDelta = await buildDiagnosticsDeltaOrSignal(options.sessionName, before);
  const run = await recordActionRun("scroll", options.sessionName, result.page, {
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

// =============================================================================
// managedScreenshot — custom record via appendRunEvent
// =============================================================================

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
  const method = "screenshot";
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

// =============================================================================
// managedPdf
// =============================================================================

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
  const run = await recordActionRun("pdf", options.sessionName, result.page, {
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

// =============================================================================
// managedUpload
// =============================================================================

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
  const diagnosticsDelta = await buildDiagnosticsDeltaOrSignal(options.sessionName, before);
  const run = await recordActionRun("upload", options.sessionName, result.page, {
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

// =============================================================================
// managedDrag — dual locator, kept handwritten
// =============================================================================

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

  const diagnosticsDelta = await buildDiagnosticsDeltaOrSignal(options.sessionName, before);
  const run = await recordActionRun("drag", options.sessionName, result.page, {
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

// =============================================================================
// managedDownload — post-processing with copyFile, kept handwritten
// =============================================================================

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
  if (dir) await mkdir(dir, { recursive: true });
  if (exactPath) await mkdir(dirname(exactPath), { recursive: true });

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
  const diagnosticsDelta = await buildDiagnosticsDeltaOrSignal(options.sessionName, before);
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

// =============================================================================
// managedReadText — pure read, no diagnostics/recordRun
// =============================================================================

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
      const iframeCount = await page.evaluate(() => document.querySelectorAll('iframe').length);
      return JSON.stringify({ source: 'selector', selector: sel, text, count, iframeCount });
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
        const iframeCount = document.querySelectorAll('iframe').length;
        return {
          source: includeOverlay ? 'body-visible+overlay' : 'body-visible',
          text: bodyText,
          overlays,
          iframeCount,
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
  const note =
    parsed.iframeCount > 0 && text.length < 50
      ? `Page has ${parsed.iframeCount} iframe(s); read-text cannot access iframe content. Use: pw snapshot -i --session <name>  or  pw code with frameLocator()`
      : undefined;

  return {
    session: result.session,
    page: result.page,
    data: {
      ...parsed,
      text,
      truncated: text.length !== rawText.length,
      charCount: text.length,
      totalCharCount: rawText.length,
      ...(note ? { note } : {}),
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

// =============================================================================
// managedWait — complex multi-condition, kept handwritten
// =============================================================================

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
  let conditionKind: RunEventTargetKind = "none";

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
    conditionKind = "selector";
    source = `async page => { await page.locator(${JSON.stringify(options.selector)}).waitFor(); return 'selector'; }`;
  } else if (options.text) {
    condition = { kind: "text", text: options.text };
    source = `async page => { await page.getByText(${JSON.stringify(options.text)}, { exact: false }).waitFor(); return 'text'; }`;
  } else if (options.target) {
    condition = { kind: "ref", ref: normalizeRef(options.target) };
    conditionKind = "ref";
    source = `async page => { await page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.target)}`)}).waitFor(); return 'ref'; }`;
  } else {
    throw new Error("wait requires a condition");
  }

  const before = await captureDiagnosticsBaseline(options.sessionName);
  let result;
  try {
    result = await executeCodeAction({
      command: "wait",
      sessionName: options.sessionName,
      source,
      before,
      details: { condition },
    });
  } catch (error) {
    await recordFailedActionRun("wait", options.sessionName, undefined, before, error, { condition });
    throw error;
  }
  return finalizeAction({
    command: "wait",
    sessionName: options.sessionName,
    page: await managedPageCurrent({ sessionName: options.sessionName }).then(
      (pageResult) => pageResult.page,
    ),
    before,
    resultData: {
      condition:
        typeof result.data.result === "string"
          ? stripQuotes(result.data.result)
          : typeof result.data.result === "object" && result.data.result
            ? result.data.result
            : String(result.data.result ?? ""),
      matched: true,
    },
    runDetails: { condition, matched: true },
    targetKind: conditionKind,
    rawText: typeof result.data.output === "string" ? result.data.output : undefined,
  });
}
