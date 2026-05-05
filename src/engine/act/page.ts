import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { assertActionAllowed } from "#store/action-policy.js";
import { appendRunEvent, ensureRunDir } from "#store/artifacts.js";
import { assertSessionAutomationControl } from "#store/control-state.js";
import { captureDiagnosticsBaseline } from "../diagnose/core.js";
import {
  parseDownloadEvent,
  parsePageSummary,
  runManagedSessionCommand,
  stripQuotes,
} from "../session.js";
import { managedRunCode, maybeRawOutput, normalizeRef } from "../shared.js";
import { managedPageCurrent } from "../workspace.js";
import {
  assertFreshRefEpoch,
  buildDiagnosticsDeltaOrSignal,
  executeCodeAction,
  finalizeAction,
  type ManagedCodeResult,
  type RunEventTargetKind,
  recordActionRun,
  recordFailedActionRun,
  throwIfManagedActionError,
} from "./element.js";

export async function managedDialog(
  action: "accept" | "dismiss",
  options?: { prompt?: string; sessionName?: string },
) {
  await assertActionAllowed("interact", "dialog");
  await assertSessionAutomationControl(options?.sessionName, "dialog");
  const command = action === "accept" ? "dialog-accept" : "dialog-dismiss";
  const argv = action === "accept" && options?.prompt ? [command, options.prompt] : [command];
  const result = await runManagedSessionCommand({ _: argv }, { sessionName: options?.sessionName });
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
  await assertSessionAutomationControl(options.sessionName, "scroll");
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
  const run = await recordActionRun(
    "scroll",
    options.sessionName,
    result.page,
    {
      direction: options.direction,
      distance,
      diagnosticsDelta,
    },
    "none",
  );
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
  const run = await recordActionRun(
    "pdf",
    options.sessionName,
    result.page,
    {
      path,
      url: typeof parsed.url === "string" ? parsed.url : undefined,
    },
    "none",
  );
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
  await assertActionAllowed("upload", "upload");
  await assertSessionAutomationControl(options.sessionName, "upload");
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
  const run = await recordActionRun(
    "upload",
    options.sessionName,
    result.page,
    {
      target: options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector },
      files: resolvedFiles,
      settle,
      nextSteps,
      diagnosticsDelta,
    },
    options.ref ? "ref" : "selector",
  );
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
  await assertActionAllowed("interact", "drag");
  await assertSessionAutomationControl(options.sessionName, "drag");
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
  const run = await recordActionRun(
    "drag",
    options.sessionName,
    result.page,
    {
      diagnosticsDelta,
    },
    options.fromRef || options.toRef ? "ref" : "selector",
  );
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
  await assertActionAllowed("download", "download");
  await assertSessionAutomationControl(options.sessionName, "download");
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
  state?: "visible" | "hidden" | "stable" | "attached" | "detached";
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
    condition = { kind: "selector", selector: options.selector, state: options.state ?? "visible" };
    conditionKind = "selector";
    source = `async page => {
      await page.locator(${JSON.stringify(options.selector)}).waitFor({
        state: ${JSON.stringify(options.state ?? "visible")},
      });
      return JSON.stringify({ kind: 'selector', selector: ${JSON.stringify(options.selector)}, state: ${JSON.stringify(options.state ?? "visible")} });
    }`;
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
  let result: ManagedCodeResult;
  try {
    result = await executeCodeAction({
      command: "wait",
      sessionName: options.sessionName,
      source,
      before,
      details: { condition },
    });
  } catch (error) {
    await recordFailedActionRun("wait", options.sessionName, undefined, before, error, {
      condition,
    });
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

// =============================================================================
// managedMouseMove
// =============================================================================

export async function managedMouseMove(options: { x: number; y: number; sessionName?: string }) {
  const before = await captureDiagnosticsBaseline(options.sessionName);
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      await page.mouse.move(${options.x}, ${options.y});
      return JSON.stringify({ x: ${options.x}, y: ${options.y} });
    }`,
  });
  const diagnosticsDelta = await buildDiagnosticsDeltaOrSignal(options.sessionName, before);
  const run = await recordActionRun(
    "mouse move",
    options.sessionName,
    result.page,
    { x: options.x, y: options.y, diagnosticsDelta },
    "none",
  );
  return {
    session: result.session,
    page: result.page,
    data: {
      x: options.x,
      y: options.y,
      acted: true,
      diagnosticsDelta,
      run,
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

// =============================================================================
// managedMouseClick
// =============================================================================

export async function managedMouseClick(options: {
  x: number;
  y: number;
  button?: "left" | "right" | "middle";
  sessionName?: string;
}) {
  const before = await captureDiagnosticsBaseline(options.sessionName);
  const buttonOpt = options.button ? `, { button: ${JSON.stringify(options.button)} }` : "";
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      await page.mouse.click(${options.x}, ${options.y}${buttonOpt});
      return JSON.stringify({ x: ${options.x}, y: ${options.y}${options.button ? `, button: ${JSON.stringify(options.button)}` : ""} });
    }`,
  });
  const diagnosticsDelta = await buildDiagnosticsDeltaOrSignal(options.sessionName, before);
  const run = await recordActionRun(
    "mouse click",
    options.sessionName,
    result.page,
    { x: options.x, y: options.y, button: options.button ?? "left", diagnosticsDelta },
    "none",
  );
  return {
    session: result.session,
    page: result.page,
    data: {
      x: options.x,
      y: options.y,
      ...(options.button ? { button: options.button } : {}),
      acted: true,
      diagnosticsDelta,
      run,
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

// =============================================================================
// managedMouseDblclick
// =============================================================================

export async function managedMouseDblclick(options: {
  x: number;
  y: number;
  sessionName?: string;
}) {
  const before = await captureDiagnosticsBaseline(options.sessionName);
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      await page.mouse.click(${options.x}, ${options.y}, { clickCount: 2 });
      return JSON.stringify({ x: ${options.x}, y: ${options.y}, clickCount: 2 });
    }`,
  });
  const diagnosticsDelta = await buildDiagnosticsDeltaOrSignal(options.sessionName, before);
  const run = await recordActionRun(
    "mouse dblclick",
    options.sessionName,
    result.page,
    { x: options.x, y: options.y, clickCount: 2, diagnosticsDelta },
    "none",
  );
  return {
    session: result.session,
    page: result.page,
    data: {
      x: options.x,
      y: options.y,
      clickCount: 2,
      acted: true,
      diagnosticsDelta,
      run,
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

// =============================================================================
// managedMouseWheel
// =============================================================================

export async function managedMouseWheel(options: {
  deltaX: number;
  deltaY: number;
  sessionName?: string;
}) {
  const before = await captureDiagnosticsBaseline(options.sessionName);
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      await page.mouse.wheel(${options.deltaX}, ${options.deltaY});
      return JSON.stringify({ deltaX: ${options.deltaX}, deltaY: ${options.deltaY} });
    }`,
  });
  const diagnosticsDelta = await buildDiagnosticsDeltaOrSignal(options.sessionName, before);
  const run = await recordActionRun(
    "mouse wheel",
    options.sessionName,
    result.page,
    { deltaX: options.deltaX, deltaY: options.deltaY, diagnosticsDelta },
    "none",
  );
  return {
    session: result.session,
    page: result.page,
    data: {
      deltaX: options.deltaX,
      deltaY: options.deltaY,
      acted: true,
      diagnosticsDelta,
      run,
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

// =============================================================================
// managedMouseDrag
// =============================================================================

export async function managedMouseDrag(options: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  sessionName?: string;
}) {
  const before = await captureDiagnosticsBaseline(options.sessionName);
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      await page.mouse.move(${options.fromX}, ${options.fromY});
      await page.mouse.down();
      await page.mouse.move(${options.toX}, ${options.toY});
      await page.mouse.up();
      return JSON.stringify({ fromX: ${options.fromX}, fromY: ${options.fromY}, toX: ${options.toX}, toY: ${options.toY} });
    }`,
  });
  const diagnosticsDelta = await buildDiagnosticsDeltaOrSignal(options.sessionName, before);
  const run = await recordActionRun(
    "mouse drag",
    options.sessionName,
    result.page,
    {
      fromX: options.fromX,
      fromY: options.fromY,
      toX: options.toX,
      toY: options.toY,
      diagnosticsDelta,
    },
    "none",
  );
  return {
    session: result.session,
    page: result.page,
    data: {
      fromX: options.fromX,
      fromY: options.fromY,
      toX: options.toX,
      toY: options.toY,
      acted: true,
      diagnosticsDelta,
      run,
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

// =============================================================================
// managedVideoStart
// =============================================================================

export async function managedVideoStart(options: { sessionName?: string }) {
  const result = await runManagedSessionCommand(
    { _: ["video-start"] },
    { sessionName: options.sessionName },
  );
  return {
    session: {
      scope: "managed" as const,
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page: parsePageSummary(result.text),
    data: {
      started: true,
      ...maybeRawOutput(result.text),
    },
  };
}

// =============================================================================
// managedVideoStop
// =============================================================================

export async function managedVideoStop(options: { sessionName?: string }) {
  const result = await runManagedSessionCommand(
    { _: ["video-stop"] },
    { sessionName: options.sessionName },
  );
  // Match [Video](path) — use a greedy match that handles paths with closing parens
  // by looking for the last ')' before a newline/end-of-string
  const videoMatch = result.text.match(/- \[Video\]\(([\s\S]+?)\)(?:\s|$)/);
  const videoPath = videoMatch?.[1]?.trim() || undefined;
  const noVideo = result.text.includes("No videos were recorded.");
  return {
    session: {
      scope: "managed" as const,
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page: parsePageSummary(result.text),
    data: {
      stopped: true,
      ...(videoPath ? { videoPath } : {}),
      ...(noVideo ? { noVideo: true } : {}),
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedResize(options: {
  sessionName?: string;
  width: number;
  height: number;
  view?: string;
  preset?: string;
}) {
  const result = await runManagedSessionCommand(
    {
      _: ["resize", String(options.width), String(options.height)],
    },
    {
      sessionName: options.sessionName,
    },
  );

  return {
    session: {
      scope: "managed",
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page: parsePageSummary(result.text),
    data: {
      width: options.width,
      height: options.height,
      ...(options.view ? { view: options.view } : {}),
      ...(options.preset ? { preset: options.preset } : {}),
      resized: true,
      ...maybeRawOutput(result.text),
    },
  };
}
