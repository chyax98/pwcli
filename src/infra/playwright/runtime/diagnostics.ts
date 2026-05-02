import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runManagedSessionCommand } from "../cli-client.js";
import { parsePageSummary } from "../output-parsers.js";
import { managedRunCode } from "./code.js";
import { managedEnsureDiagnosticsHooks } from "./hooks.js";
import { maybeRawOutput, stateAccessPrelude } from "./shared.js";
import { managedWorkspaceProjection } from "./workspace.js";

const TRACE_INSPECT_OUTPUT_LIMIT = 50_000;

export type TraceInspectSection = "actions" | "requests" | "console" | "errors";

export class TraceInspectError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "TraceInspectError";
    this.code = code;
    this.details = details;
  }
}

function packageRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
}

function playwrightTraceCliPaths() {
  const root = packageRoot();
  return {
    entrypoint: resolve(root, "node_modules", "playwright-core", "cli.js"),
    traceCli: resolve(
      root,
      "node_modules",
      "playwright-core",
      "lib",
      "tools",
      "trace",
      "traceCli.js",
    ),
  };
}

function runTraceCli(args: string[], cwd: string) {
  const paths = playwrightTraceCliPaths();
  if (!existsSync(paths.entrypoint) || !existsSync(paths.traceCli)) {
    throw new TraceInspectError(
      "TRACE_CLI_UNAVAILABLE",
      "Playwright trace CLI is unavailable in the installed playwright-core package",
      {
        entrypoint: paths.entrypoint,
        entrypointAvailable: existsSync(paths.entrypoint),
        traceCli: paths.traceCli,
        traceCliAvailable: existsSync(paths.traceCli),
      },
    );
  }

  const result = spawnSync(process.execPath, [paths.entrypoint, "trace", ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: TRACE_INSPECT_OUTPUT_LIMIT * 200,
  });
  return {
    ...result,
    command: `playwright trace ${args.map((arg) => (arg.includes(" ") ? JSON.stringify(arg) : arg)).join(" ")}`,
  };
}

function boundedOutput(value: string, lineLimit?: number) {
  const lines = value.split(/\r?\n/);
  const lineLimited = lineLimit && lineLimit > 0 && lines.length > lineLimit;
  const lineLimitedValue = lineLimited ? lines.slice(0, lineLimit).join("\n") : value;
  const charLimited = lineLimitedValue.length > TRACE_INSPECT_OUTPUT_LIMIT;
  const output = charLimited
    ? lineLimitedValue.slice(0, TRACE_INSPECT_OUTPUT_LIMIT)
    : lineLimitedValue;
  return {
    output,
    outputCharCount: value.length,
    outputLineCount: lines.length,
    ...(lineLimit && lineLimit > 0 ? { outputLinesShown: Math.min(lines.length, lineLimit) } : {}),
    truncated: lineLimited || charLimited,
  };
}

function traceSectionArgs(options: {
  section: TraceInspectSection;
  failed?: boolean;
  level?: string;
}) {
  const args: string[] = [options.section];
  const limitations: string[] = [];

  if (options.failed) {
    if (options.section === "requests") {
      args.push("--failed");
    } else {
      limitations.push("TRACE_FAILED_FILTER_REQUESTS_ONLY");
    }
  }

  const level = options.level?.trim().toLowerCase();
  if (level) {
    if (options.section !== "console") {
      limitations.push("TRACE_LEVEL_FILTER_CONSOLE_ONLY");
    } else if (level === "error") {
      args.push("--errors-only");
    } else if (level === "warning" || level === "warn") {
      args.push("--warnings");
    } else {
      limitations.push("TRACE_CONSOLE_LEVEL_FILTER_LIMITED");
    }
  }

  return { args, limitations };
}

export async function managedTraceInspect(options: {
  tracePath: string;
  section: TraceInspectSection;
  failed?: boolean;
  level?: string;
  limit?: number;
}) {
  const tracePath = resolve(options.tracePath);
  if (!existsSync(tracePath)) {
    throw new TraceInspectError("TRACE_FILE_NOT_FOUND", "Trace file does not exist", {
      tracePath,
    });
  }

  const tempDir = mkdtempSync(resolve(tmpdir(), "pwcli-trace-"));
  try {
    const openResult = runTraceCli(["open", tracePath], tempDir);
    const openOutput = `${openResult.stdout ?? ""}${openResult.stderr ?? ""}`;
    if (openResult.error) {
      throw new TraceInspectError("TRACE_CLI_FAILED", "Playwright trace CLI failed to open trace", {
        command: openResult.command,
        errorMessage: openResult.error.message,
        ...boundedOutput(openOutput, options.limit),
      });
    }
    if (openResult.status !== 0) {
      throw new TraceInspectError("TRACE_CLI_FAILED", "Playwright trace CLI failed to open trace", {
        command: openResult.command,
        exitCode: openResult.status,
        signal: openResult.signal,
        ...boundedOutput(openOutput, options.limit),
      });
    }

    const { args, limitations } = traceSectionArgs(options);
    const sectionResult = runTraceCli(args, tempDir);
    const output = `${sectionResult.stdout ?? ""}${sectionResult.stderr ?? ""}`;
    if (sectionResult.error) {
      throw new TraceInspectError(
        "TRACE_CLI_FAILED",
        "Playwright trace CLI failed to inspect trace",
        {
          command: sectionResult.command,
          errorMessage: sectionResult.error.message,
          ...boundedOutput(output, options.limit),
        },
      );
    }
    if (sectionResult.status !== 0) {
      throw new TraceInspectError(
        "TRACE_CLI_FAILED",
        "Playwright trace CLI failed to inspect trace",
        {
          command: sectionResult.command,
          exitCode: sectionResult.status,
          signal: sectionResult.signal,
          ...boundedOutput(output, options.limit),
        },
      );
    }

    return {
      data: {
        section: options.section,
        tracePath,
        command: sectionResult.command,
        commands: [openResult.command, sectionResult.command],
        failed: options.failed && options.section === "requests" ? true : undefined,
        level: options.level ?? null,
        limit: options.limit ?? null,
        limitations,
        ...(limitations.length > 0 ? { limitation: limitations.join(",") } : {}),
        ...boundedOutput(output, options.limit),
      },
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export async function managedTrace(action: "start" | "stop", options?: { sessionName?: string }) {
  const command = action === "start" ? "tracing-start" : "tracing-stop";
  const result = await runManagedSessionCommand(
    {
      _: [command],
    },
    {
      sessionName: options?.sessionName,
    },
  );
  const traceState = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      ${stateAccessPrelude()}
      state.trace = {
        active: ${action === "start" ? "true" : "false"},
        supported: true,
        lastAction: ${JSON.stringify(action)},
        updatedAt: new Date().toISOString(),
      };
      return JSON.stringify(state.trace);
    }`,
  })
    .then((traceResult) => traceResult.data.result)
    .catch(() => undefined);
  const traceArtifactPath = parseTraceArtifactPath(result.text);

  return {
    session: {
      scope: "managed",
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page: parsePageSummary(result.text),
    data: {
      action,
      started: action === "start" ? true : undefined,
      stopped: action === "stop" ? true : undefined,
      ...(traceArtifactPath ? { traceArtifactPath } : {}),
      ...(action === "stop" && traceArtifactPath
        ? {
            nextStep: `pw trace inspect ${JSON.stringify(traceArtifactPath)} --section actions`,
            inspectHint:
              "Use `pw trace inspect <traceArtifactPath> --section actions|requests|console|errors` to inspect the saved trace artifact.",
          }
        : {}),
      ...(traceState ? { trace: traceState } : {}),
      ...maybeRawOutput(result.text),
    },
  };
}

function parseTraceArtifactPath(text: string) {
  const match = text.match(/^- \[Trace\]\(([^)]+)\)$/m);
  return match?.[1];
}

export async function managedErrors(
  action: "recent" | "clear",
  options?: {
    sessionName?: string;
    text?: string;
    limit?: number;
    since?: string;
    current?: boolean;
  },
) {
  await managedEnsureDiagnosticsHooks({ sessionName: options?.sessionName });

  let currentNavId: string | null = null;
  if (options?.current) {
    const { managedWorkspaceProjection } = await import("./workspace.js");
    const projection = await managedWorkspaceProjection({ sessionName: options?.sessionName });
    currentNavId = projection.data?.workspace?.currentNavigationId ?? null;
  }

  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      ${stateAccessPrelude()}
      state.pageErrorRecords = Array.isArray(state.pageErrorRecords) ? state.pageErrorRecords : [];
      const allErrors = state.pageErrorRecords;
      const clearedCount = Number.isInteger(state.pageErrorClearedCount) ? state.pageErrorClearedCount : 0;
      if (${JSON.stringify(action)} === 'clear') {
        state.pageErrorClearedCount = allErrors.length;
        return JSON.stringify({
          action: 'clear',
          cleared: true,
          totalErrors: allErrors.length,
          clearedCount: allErrors.length,
          visibleCount: 0,
          errors: [],
        });
      }
      const textFilter = ${JSON.stringify(options?.text ?? "")};
      const sinceFilter = ${JSON.stringify(options?.since ?? "")};
      const sinceTime = sinceFilter ? Date.parse(sinceFilter) : NaN;
      const currentNavId = ${JSON.stringify(currentNavId)};
      const limit = ${JSON.stringify(options?.limit ?? 20)};
      const visible = allErrors.slice(clearedCount).map((error, index) => ({
        index: clearedCount + index + 1,
        ...error,
      }));
      const errors = visible
        .filter(error => {
          if (!Number.isNaN(sinceTime)) {
            const recordTime = Date.parse(String(error.timestamp || ''));
            if (Number.isNaN(recordTime) || recordTime < sinceTime)
              return false;
          }
          if (currentNavId && error.navigationId !== currentNavId)
            return false;
          return !textFilter || String(error.text || '').includes(textFilter);
        })
        .slice(-Math.max(0, Number(limit || 0) || 20));
      return JSON.stringify({
        action: 'recent',
        clearedCount,
        totalErrors: allErrors.length,
        visibleCount: visible.length,
        currentNavigation: currentNavId || undefined,
        errors,
      });
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};

  return {
    session: result.session,
    page: result.page,
    data: {
      action,
      summary: {
        total: Number(parsed.totalErrors ?? 0),
        visible: Number(parsed.visibleCount ?? 0),
        clearedCount: Number(parsed.clearedCount ?? 0),
        matched: Array.isArray(parsed.errors) ? parsed.errors.length : 0,
      },
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
    },
  };
}

export async function managedRoute(
  action: "add" | "remove" | "list",
  options: {
    pattern?: string;
    abort?: boolean;
    body?: string;
    status?: number;
    contentType?: string;
    headers?: Record<string, string>;
    mergeHeaders?: Record<string, string>;
    matchBody?: string;
    matchQuery?: Record<string, string>;
    matchHeaders?: Record<string, string>;
    matchJson?: unknown;
    injectHeaders?: Record<string, string>;
    patchJson?: unknown;
    patchText?: Record<string, string>;
    patchStatus?: number;
    method?: string;
    sessionName?: string;
  },
) {
  if (action === "add" && !options.pattern) {
    throw new Error("route add requires a pattern");
  }
  const hasFulfill =
    options.body !== undefined ||
    options.status !== undefined ||
    options.contentType !== undefined ||
    options.headers !== undefined;
  const hasPatch =
    options.patchJson !== undefined ||
    options.patchText !== undefined ||
    options.patchStatus !== undefined;
  if (action === "add" && options.injectHeaders && (options.abort || hasFulfill)) {
    throw new Error("route add inject mode cannot be combined with abort or fulfill options");
  }
  if (action === "add" && hasPatch && (options.abort || hasFulfill || options.injectHeaders)) {
    throw new Error(
      "route add response patch mode cannot be combined with abort, fulfill, or inject options",
    );
  }

  const config = {
    abort: Boolean(options.abort),
    body: options.body,
    status: options.status,
    contentType: options.contentType,
    headers: options.headers,
    mergeHeaders: options.mergeHeaders,
    matchBody: options.matchBody,
    matchQuery: options.matchQuery,
    matchHeaders: options.matchHeaders,
    matchJson: options.matchJson,
    injectHeaders: options.injectHeaders,
    patchJson: options.patchJson,
    patchText: options.patchText,
    patchStatus: options.patchStatus,
    method: options.method?.toUpperCase(),
  };
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source:
      action === "list"
        ? `async page => {
      ${stateAccessPrelude()}
      state.routes = Array.isArray(state.routes) ? state.routes : [];
      return JSON.stringify({
        action: 'list',
        routeCount: state.routes.length,
        routes: state.routes,
      });
    }`
        : action === "add"
          ? `async page => {
      ${stateAccessPrelude()}
      state.routes = Array.isArray(state.routes) ? state.routes : [];
      const pattern = ${JSON.stringify(options.pattern)};
      const config = ${JSON.stringify(config)};
      const applyMergePatch = (target, patch) => {
        if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
          return patch;
        }
        const base =
          target && typeof target === 'object' && !Array.isArray(target) ? { ...target } : {};
        for (const [key, value] of Object.entries(patch)) {
          if (value === null) {
            delete base[key];
            continue;
          }
          base[key] = applyMergePatch(base[key], value);
        }
        return base;
      };
      const containsSubset = (target, subset) => {
        if (subset === null || typeof subset !== 'object' || Array.isArray(subset))
          return JSON.stringify(target) === JSON.stringify(subset);
        if (target === null || typeof target !== 'object' || Array.isArray(target))
          return false;
        return Object.entries(subset).every(([key, value]) => containsSubset(target[key], value));
      };
      await context.route(pattern, async route => {
        const request = route.request();
        if (config.method && request.method().toUpperCase() !== config.method) {
          await route.fallback();
          return;
        }
        if (config.matchBody) {
          const postData = request.postData();
          if (typeof postData !== 'string' || !postData.includes(config.matchBody)) {
            await route.fallback();
            return;
          }
        }
        if (config.matchQuery) {
          const url = new URL(request.url());
          const queryMatched = Object.entries(config.matchQuery).every(([key, value]) => url.searchParams.get(key) === value);
          if (!queryMatched) {
            await route.fallback();
            return;
          }
        }
        if (config.matchHeaders) {
          const headers = await request.allHeaders();
          const headersMatched = Object.entries(config.matchHeaders).every(([key, value]) => String(headers[key] || '') === value);
          if (!headersMatched) {
            await route.fallback();
            return;
          }
        }
        if (config.matchJson !== undefined) {
          const postData = request.postData();
          if (typeof postData !== 'string') {
            await route.fallback();
            return;
          }
          let parsedBody;
          try {
            parsedBody = JSON.parse(postData);
          } catch {
            await route.fallback();
            return;
          }
          if (!containsSubset(parsedBody, config.matchJson)) {
            await route.fallback();
            return;
          }
        }
        if (config.injectHeaders) {
          const requestHeaders = await request.allHeaders();
          await route.continue({
            headers: {
              ...requestHeaders,
              ...config.injectHeaders,
            },
          });
          return;
        }
        if (config.abort) {
          await route.abort();
          return;
        }
        if (config.patchJson !== undefined || config.patchText !== undefined || config.patchStatus !== undefined) {
          const upstream = await route.fetch();
          const headers = { ...upstream.headers() };
          if (config.mergeHeaders)
            Object.assign(headers, config.mergeHeaders);
          delete headers['content-length'];
          const status = config.patchStatus ?? upstream.status();
          if (config.patchJson === undefined && config.patchText === undefined) {
            await route.fulfill({
              response: upstream,
              status,
              headers,
            });
            return;
          }
          const sourceText = await upstream.text();
          if (config.patchText !== undefined) {
            let patchedText = sourceText;
            for (const [from, to] of Object.entries(config.patchText)) {
              patchedText = patchedText.split(from).join(to);
            }
            await route.fulfill({
              response: upstream,
              status,
              headers,
              body: patchedText,
            });
            return;
          }
          const contentType = String(headers['content-type'] || '');
          if (!contentType.includes('application/json')) {
            throw new Error('route patch json mode requires an upstream application/json response');
          }
          const sourceJson = sourceText ? JSON.parse(sourceText) : null;
          const patchedJson = applyMergePatch(sourceJson, config.patchJson);
          headers['content-type'] = contentType || 'application/json; charset=utf-8';
          await route.fulfill({
            response: upstream,
            status,
            headers,
            body: JSON.stringify(patchedJson),
          });
          return;
        }
        if (config.body !== undefined || config.status !== undefined || config.contentType !== undefined || config.headers !== undefined) {
          const fulfillOptions = {
            status: config.status ?? 200,
            body: config.body ?? '',
          };
          if (config.contentType)
            fulfillOptions.contentType = config.contentType;
          if (config.headers)
            fulfillOptions.headers = config.headers;
          await route.fulfill(fulfillOptions);
          return;
        }
        await route.continue();
      });
      const routeRecord = {
        pattern,
        mode: config.abort
          ? 'abort'
          : config.injectHeaders
            ? 'inject-continue'
            : (config.patchJson !== undefined || config.patchStatus !== undefined)
              ? 'patch-response'
              : (config.body !== undefined || config.status !== undefined || config.contentType !== undefined || config.headers !== undefined)
                ? 'fulfill'
                : 'continue',
        addedAt: new Date().toISOString(),
      };
      if (config.status !== undefined)
        routeRecord.status = config.status;
      if (config.patchStatus !== undefined)
        routeRecord.patchStatus = config.patchStatus;
      if (config.contentType)
        routeRecord.contentType = config.contentType;
      if (config.method)
        routeRecord.method = config.method;
      if (config.matchBody)
        routeRecord.matchBody = config.matchBody;
      if (config.matchQuery)
        routeRecord.matchQuery = config.matchQuery;
      if (config.matchHeaders)
        routeRecord.matchHeaders = config.matchHeaders;
      if (config.matchJson !== undefined)
        routeRecord.matchJson = config.matchJson;
      if (config.headers)
        routeRecord.headers = config.headers;
      if (config.mergeHeaders)
        routeRecord.mergeHeaders = config.mergeHeaders;
      if (config.injectHeaders)
        routeRecord.injectHeaders = config.injectHeaders;
      if (config.patchJson !== undefined)
        routeRecord.patchJson = config.patchJson;
      if (config.patchText !== undefined)
        routeRecord.patchText = config.patchText;
      if (config.body !== undefined) {
        routeRecord.hasBody = true;
        routeRecord.bodyPreview = config.body.length > 120 ? config.body.slice(0, 120) + '...' : config.body;
      }
      state.routes.push(routeRecord);
      return JSON.stringify({
        action: 'add',
        added: true,
        route: routeRecord,
        routeCount: state.routes.length,
      });
    }`
          : `async page => {
      ${stateAccessPrelude()}
      const pattern = ${JSON.stringify(options.pattern ?? null)};
      const existing = Array.isArray(state.routes) ? state.routes : [];
      if (pattern) {
        await context.unroute(pattern);
        state.routes = existing.filter(route => route.pattern !== pattern);
      } else {
        await context.unrouteAll({ behavior: 'ignoreErrors' });
        state.routes = [];
      }
      return JSON.stringify({
        action: 'remove',
        removedPattern: pattern,
        removedCount: pattern ? existing.length - state.routes.length : existing.length,
        routeCount: state.routes.length,
        routes: state.routes,
      });
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};

  return {
    session: result.session,
    page: result.page,
    data: {
      action,
      ...(action === "add" ? { added: true } : {}),
      ...(action === "remove" ? { removed: true } : {}),
      ...(parsed.route ? { route: parsed.route } : {}),
      ...(parsed.removedPattern !== undefined ? { pattern: parsed.removedPattern } : {}),
      ...(parsed.removedCount !== undefined ? { removedCount: parsed.removedCount } : {}),
      routeCount: Number(parsed.routeCount ?? 0),
      ...(Array.isArray(parsed.routes) ? { routes: parsed.routes } : {}),
    },
  };
}

export async function managedHar(
  action: "start" | "stop",
  options?: { path?: string; sessionName?: string },
) {
  const limitation =
    "Current managed sessions do not expose HAR start/stop on an existing BrowserContext. Recreate the session with HAR recording once the substrate exists.";
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      ${stateAccessPrelude()}
      state.har = {
        supported: false,
        active: false,
        lastAction: ${JSON.stringify(action)},
        limitation: ${JSON.stringify(limitation)},
        updatedAt: new Date().toISOString(),
      };
      if (${JSON.stringify(options?.path ?? null)})
        state.har.requestedPath = ${JSON.stringify(options?.path ?? null)};
      return JSON.stringify(state.har);
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};

  return {
    session: result.session,
    page: result.page,
    data: {
      action,
      supported: false,
      limitation,
      ...(options?.path ? { requestedPath: resolve(options.path) } : {}),
      har: parsed,
    },
  };
}

export async function managedHarReplay(options: {
  filePath: string;
  sessionName?: string;
  update?: boolean;
}) {
  const resolvedPath = resolve(options.filePath);
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      ${stateAccessPrelude()}
      await context.routeFromHAR(${JSON.stringify(resolvedPath)}, {
        notFound: 'abort',
        update: ${options.update ? "true" : "false"},
      });
      state.harReplay = {
        active: true,
        file: ${JSON.stringify(resolvedPath)},
        update: ${options.update ? "true" : "false"},
        startedAt: new Date().toISOString(),
      };
      return JSON.stringify({ replayActive: true, file: ${JSON.stringify(resolvedPath)} });
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};

  return {
    session: result.session,
    page: result.page,
    data: {
      replayActive: true,
      file: resolvedPath,
      update: options.update ?? false,
      ...(parsed as Record<string, unknown>),
    },
  };
}

export async function managedHarReplayStop(options: {
  sessionName?: string;
}) {
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      ${stateAccessPrelude()}
      await context.unrouteAll({ behavior: 'ignoreErrors' });
      state.harReplay = {
        active: false,
        stoppedAt: new Date().toISOString(),
      };
      state.routes = [];
      return JSON.stringify({ replayActive: false });
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};

  return {
    session: result.session,
    page: result.page,
    data: {
      replayActive: false,
      ...(parsed as Record<string, unknown>),
    },
  };
}

export async function managedObserveStatus(options?: { sessionName?: string }) {
  const projection = await managedWorkspaceProjection({ sessionName: options?.sessionName });
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      ${stateAccessPrelude({ readonly: true })}
      const clearedCount = Number.isInteger(state.pageErrorClearedCount) ? state.pageErrorClearedCount : 0;
      const visibleCount = Math.max(0, state.pageErrorRecords.length - clearedCount);
      const routes = Array.isArray(state.routes) ? state.routes : [];
      const trace = state.trace || { supported: true, active: false };
      const har = state.har || {
        supported: false,
        active: false,
        limitation: 'Current managed sessions do not expose HAR start/stop on an existing BrowserContext.',
      };
      const bootstrap = state.bootstrap || {
        applied: false,
        initScriptCount: 0,
        headersApplied: false,
      };
      // Detect visible HTML modals/overlays that may block interactions.
      const visibleModals = await page.evaluate(() => {
        const selectors = [
          '[role="dialog"]',
          '[role="alertdialog"]',
          '[aria-modal="true"]',
          '.modal',
          '.ant-modal',
          '.el-dialog',
        ];
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
              text: text.substring(0, 200),
            };
          })
          .filter(m => m.text);
      });

      return JSON.stringify({
        console: {
          total: state.consoleRecords.length,
          last: state.consoleRecords.at(-1) || null,
        },
        network: {
          total: state.networkRecords.length,
          requests: state.networkRecords.filter(record => record.event === 'request').length,
          responses: state.networkRecords.filter(record => record.event === 'response').length,
          failures: state.networkRecords.filter(record => record.event === 'requestfailed').length,
          last: state.networkRecords.at(-1) || null,
        },
        routes: {
          count: routes.length,
          items: routes,
        },
        pageErrors: {
          total: state.pageErrorRecords.length,
          clearedCount,
          visibleCount,
          last: state.pageErrorRecords.at(-1) || null,
        },
        modals: {
          count: visibleModals.length,
          items: visibleModals,
        },
        trace,
        har,
        bootstrap,
        stream: {
          supported: false,
          active: false,
          limitation: 'observe stream is not wired yet on the managed session substrate',
        },
      });
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};

  return {
    session: projection.session,
    page: projection.page,
    data: {
      status: {
        page: projection.data.page,
        workspace: projection.data.workspace,
        dialogs: projection.data.dialogs,
        ...parsed,
      },
      workspace: projection.data.workspace,
      console: parsed.console,
      network: parsed.network,
      routes: parsed.routes,
      dialogs: projection.data.dialogs,
      pageErrors: parsed.pageErrors,
      modals: parsed.modals,
      trace: parsed.trace,
      har: parsed.har,
      bootstrap: parsed.bootstrap,
      stream: parsed.stream,
    },
  };
}

export async function managedConsole(
  level?: string,
  options?: {
    sessionName?: string;
    source?: string;
    text?: string;
    limit?: number;
    since?: string;
    current?: boolean;
  },
) {
  await managedEnsureDiagnosticsHooks({ sessionName: options?.sessionName });

  // Get current navigation ID from workspace projection if --current is set.
  let currentNavId: string | null = null;
  if (options?.current) {
    const { managedWorkspaceProjection } = await import("./workspace.js");
    const projection = await managedWorkspaceProjection({ sessionName: options?.sessionName });
    currentNavId = projection.data?.workspace?.currentNavigationId ?? null;
  }

  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      ${stateAccessPrelude({ readonly: true })}
      const records = Array.isArray(state.consoleRecords) ? state.consoleRecords : [];
      const order = { error: 3, warning: 2, warn: 2, info: 1, log: 1, debug: 0 };
      const threshold = ${JSON.stringify(level ?? "info")};
      const thresholdRank = order[threshold] ?? 1;
      const sourceFilter = ${JSON.stringify(options?.source ?? "")};
      const textFilter = ${JSON.stringify(options?.text ?? "")};
      const sinceFilter = ${JSON.stringify(options?.since ?? "")};
      const sinceTime = sinceFilter ? Date.parse(sinceFilter) : NaN;
      const currentNavId = ${JSON.stringify(currentNavId)};
      const limit = ${JSON.stringify(options?.limit ?? 20)};
      const filtered = records.filter(record => {
        if ((order[record.level] ?? 1) < thresholdRank)
          return false;
        if (!Number.isNaN(sinceTime)) {
          const recordTime = Date.parse(String(record.timestamp || ''));
          if (Number.isNaN(recordTime) || recordTime < sinceTime)
            return false;
        }
        if (sourceFilter && String(record.source || '') !== sourceFilter)
          return false;
        if (textFilter && !String(record.text || '').includes(textFilter))
          return false;
        if (currentNavId && record.navigationId !== currentNavId)
          return false;
        return true;
      });
      return JSON.stringify({
        total: filtered.length,
        errors: filtered.filter(record => record.level === 'error').length,
        warnings: filtered.filter(record => record.level === 'warning' || record.level === 'warn').length,
        source: sourceFilter || null,
        currentNavigation: currentNavId || undefined,
        sample: filtered.slice(-Math.max(0, Number(limit || 0) || 20)),
      });
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};
  return {
    session: result.session,
    page: result.page,
    data: {
      summary: parsed,
      ...maybeRawOutput(result.rawText ?? ""),
    },
  };
}

export async function managedNetwork(options?: {
  sessionName?: string;
  requestId?: string;
  method?: string;
  status?: string;
  resourceType?: string;
  text?: string;
  url?: string;
  kind?: "request" | "response" | "requestfailed" | "console-resource-error";
  limit?: number;
  since?: string;
  current?: boolean;
  includeBody?: boolean;
}) {
  await managedEnsureDiagnosticsHooks({ sessionName: options?.sessionName });

  let currentNavId: string | null = null;
  if (options?.current) {
    const { managedWorkspaceProjection } = await import("./workspace.js");
    const projection = await managedWorkspaceProjection({ sessionName: options?.sessionName });
    currentNavId = projection.data?.workspace?.currentNavigationId ?? null;
  }

  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      ${stateAccessPrelude({ readonly: true })}
      const records = Array.isArray(state.networkRecords) ? state.networkRecords : [];
      const requestId = ${JSON.stringify(options?.requestId ?? "")};
      const methodFilter = ${JSON.stringify(options?.method?.toUpperCase() ?? "")};
      const statusFilter = ${JSON.stringify(options?.status ?? "")};
      const resourceTypeFilter = ${JSON.stringify(options?.resourceType ?? "")};
      const textFilter = ${JSON.stringify(options?.text ?? "")};
      const urlFilter = ${JSON.stringify(options?.url ?? "")};
      const kindFilter = ${JSON.stringify(options?.kind ?? "")};
      const sinceFilter = ${JSON.stringify(options?.since ?? "")};
      const sinceTime = sinceFilter ? Date.parse(sinceFilter) : NaN;
      const currentNavId = ${JSON.stringify(currentNavId)};
      const limit = ${JSON.stringify(options?.limit ?? 20)};
      const includeBody = ${JSON.stringify(options?.includeBody ?? false)};
      const mapRecord = (record) => {
        if (!includeBody) {
          const { requestBody, requestBodyTruncatedAt50k, responseBody, responseBodyTruncatedAt50k, ...rest } = record;
          return rest;
        }
        const { requestBodyTruncatedAt50k, responseBodyTruncatedAt50k, ...rest } = record;
        const mapped = { ...rest };
        if (record.requestBody !== undefined) {
          mapped.requestBody = record.requestBody;
          mapped.requestBodyTruncated = record.requestBodyTruncatedAt50k || false;
        }
        if (record.responseBody !== undefined) {
          mapped.responseBody = record.responseBody;
          mapped.responseBodyTruncated = record.responseBodyTruncatedAt50k || false;
        }
        return mapped;
      };
      const filtered = records.filter(record => {
        if (requestId && record.requestId !== requestId)
          return false;
        if (!Number.isNaN(sinceTime)) {
          const recordTime = Date.parse(String(record.timestamp || ''));
          if (Number.isNaN(recordTime) || recordTime < sinceTime)
            return false;
        }
        if (kindFilter && String(record.event || record.kind || '') !== kindFilter)
          return false;
        if (methodFilter && String(record.method || '').toUpperCase() !== methodFilter)
          return false;
        if (statusFilter && String(record.status ?? '') !== statusFilter)
          return false;
        if (resourceTypeFilter && String(record.resourceType || '') !== resourceTypeFilter)
          return false;
        if (urlFilter && !String(record.url || '').includes(urlFilter))
          return false;
        if (currentNavId && record.navigationId !== currentNavId)
          return false;
        if (textFilter) {
          const haystack = [
            record.url,
            record.failureText,
            record.method,
            record.resourceType,
            record.requestBodySnippet,
            record.responseBodySnippet,
          ]
            .filter(Boolean)
            .join(' ');
          if (!haystack.includes(textFilter))
            return false;
        }
        return true;
      });
      const sample = filtered.slice(-Math.max(0, Number(limit || 0) || 20)).map(mapRecord);
      const detailRaw = requestId ? filtered[filtered.length - 1] || null : null;
      const detail = detailRaw ? mapRecord(detailRaw) : null;
      return JSON.stringify({
        total: filtered.length,
        currentNavigation: currentNavId || undefined,
        sample,
        detail,
      });
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};
  return {
    session: result.session,
    page: result.page,
    data: {
      summary: parsed,
      ...(parsed.detail ? { detail: parsed.detail } : {}),
      ...maybeRawOutput(result.rawText ?? ""),
    },
  };
}

export async function captureDiagnosticsBaseline(sessionName?: string) {
  const status = await managedObserveStatus({ sessionName });
  return {
    consoleTotal: status.data.console?.total ?? 0,
    networkTotal: status.data.network?.total ?? 0,
    pageErrorTotal: status.data.pageErrors?.total ?? 0,
  };
}

export async function buildDiagnosticsDelta(
  sessionName: string | undefined,
  before: { consoleTotal: number; networkTotal: number; pageErrorTotal: number },
) {
  const status = await managedObserveStatus({ sessionName });
  return {
    consoleDelta: Math.max(0, (status.data.console?.total ?? 0) - before.consoleTotal),
    networkDelta: Math.max(0, (status.data.network?.total ?? 0) - before.networkTotal),
    pageErrorDelta: Math.max(0, (status.data.pageErrors?.total ?? 0) - before.pageErrorTotal),
    lastConsole: status.data.console?.last ?? null,
    lastNetwork: status.data.network?.last ?? null,
    lastPageError: status.data.pageErrors?.last ?? null,
  };
}

export async function managedDiagnosticsExport(options?: { sessionName?: string }) {
  const workspace = await managedObserveStatus({ sessionName: options?.sessionName });
  const records = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      ${stateAccessPrelude({ readonly: true })}
      return JSON.stringify({
        console: Array.isArray(state.consoleRecords) ? state.consoleRecords : [],
        network: Array.isArray(state.networkRecords) ? state.networkRecords : [],
        errors: Array.isArray(state.pageErrorRecords) ? state.pageErrorRecords : [],
        routes: Array.isArray(state.routes) ? state.routes : [],
        bootstrap: state.bootstrap || null,
        sse: Array.isArray(state.sseRecords) ? state.sseRecords : [],
      });
    }`,
  });
  const parsed =
    typeof records.data.result === "object" && records.data.result ? records.data.result : {};

  return {
    session: workspace.session,
    page: workspace.page,
    data: {
      session: workspace.session?.name ?? options?.sessionName ?? null,
      workspace: workspace.data.workspace,
      console: Array.isArray(parsed.console) ? parsed.console : [],
      network: Array.isArray(parsed.network) ? parsed.network : [],
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
      routes: Array.isArray(parsed.routes) ? parsed.routes : [],
      bootstrap: parsed.bootstrap ?? null,
      sse: Array.isArray(parsed.sse) ? parsed.sse : [],
    },
  };
}
