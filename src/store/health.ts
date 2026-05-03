import {
  accessSync,
  constants,
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { connect as connectNet } from "node:net";
import { connect as connectTls } from "node:tls";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DoctorStatus = "ok" | "warn" | "fail" | "skipped";

export type DoctorDiagnostic = {
  kind: string;
  status: DoctorStatus;
  summary: string;
  details: Record<string, unknown>;
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function expandPath(input: string): string {
  if (input === "~") return homedir();
  if (input.startsWith("~/")) return resolve(homedir(), input.slice(2));
  return resolve(input);
}

export function summarizeDiagnostics(diagnostics: DoctorDiagnostic[]) {
  return diagnostics.reduce(
    (summary, d) => { summary[d.status] += 1; return summary; },
    { ok: 0, warn: 0, fail: 0, skipped: 0 },
  );
}

export function compactDoctorDiagnostic(diagnostic: DoctorDiagnostic): DoctorDiagnostic {
  const d = diagnostic.details ?? {};
  switch (diagnostic.kind) {
    case "session-substrate": {
      const probe = objectRecord(d.probe);
      const page = objectRecord(probe.page);
      return { ...diagnostic, details: {
        requestedSession: stringValue(d.requestedSession),
        alive: d.alive === true,
        socketReachable: probe.reachable === true,
        page: { url: stringValue(page.url), title: stringValue(page.title) },
      }};
    }
    case "observe-status": {
      const workspace = objectRecord(d.workspace);
      const pageErrors = objectRecord(d.pageErrors);
      const routes = objectRecord(d.routes);
      const trace = objectRecord(d.trace);
      const bootstrap = objectRecord(d.bootstrap);
      return { ...diagnostic, details: {
        sessionName: stringValue(d.sessionName),
        page: { url: stringValue(objectRecord(d.page).url), title: stringValue(objectRecord(d.page).title) },
        workspace: { pageCount: numberValue(workspace.pageCount) ?? 0, currentPageId: stringValue(workspace.currentPageId) },
        routes: { count: numberValue(routes.count) ?? 0 },
        pageErrors: { visibleCount: numberValue(pageErrors.visibleCount) ?? 0 },
        trace: { active: trace.active === true },
        bootstrap: { applied: bootstrap.applied === true },
      }};
    }
    case "modal-state":
      return { ...diagnostic, details: { sessionName: stringValue(d.sessionName), code: stringValue(d.code) }};
    case "auth-provider-resolution":
      return { ...diagnostic, details: {
        requestedProvider: stringValue(d.requestedProvider),
        resolved: d.resolved === true,
        discoveredCount: numberValue(d.discoveredCount) ?? 0,
      }};
    case "profile-path":
      return { ...diagnostic, details: {
        requestedPath: stringValue(d.requestedPath),
        resolvedPath: stringValue(d.resolvedPath),
        exists: d.exists === true,
        writable: d.writable === true,
        usable: d.usable === true,
      }};
    case "state-path":
      return { ...diagnostic, details: {
        requestedPath: stringValue(d.requestedPath),
        resolvedPath: stringValue(d.resolvedPath),
        exists: d.exists === true,
        readable: d.readable === true,
        validJson: d.validJson === true,
        cookieCount: numberValue(d.cookieCount) ?? 0,
        originCount: numberValue(d.originCount) ?? 0,
        ...(stringValue(d.parseError) ? { parseError: stringValue(d.parseError) } : {}),
      }};
    case "endpoint-reachability":
      return { ...diagnostic, details: {
        endpoint: stringValue(d.endpoint),
        protocol: stringValue(d.protocol),
        statusCode: numberValue(d.statusCode),
        host: stringValue(d.host),
        port: numberValue(d.port),
        ...(stringValue(d.error) ? { error: stringValue(d.error) } : {}),
      }};
    case "bootstrap-config":
      return { ...diagnostic, details: {
        sessionName: stringValue(d.sessionName),
        bootstrapConfigMissing: d.bootstrapConfigMissing === true,
        initScriptCount: numberValue(d.initScriptCount) ?? 0,
        appliedAt: stringValue(d.appliedAt),
      }};
    case "environment": {
      const items = (d.items ?? []) as Array<{ label: string; status: DoctorStatus; detail: string }>;
      const issues = items.filter((i) => i.status !== "ok");
      return { ...diagnostic,
        status: issues.some((i) => i.status === "fail") ? "fail" : issues.length > 0 ? "warn" : "ok",
        summary: issues.length > 0 ? "Environment issues detected" : "Environment checks passed",
        details: { items: issues },
      };
    }
    default:
      return diagnostic;
  }
}

export function doctorRecovery(diagnostics: DoctorDiagnostic[]) {
  const modal = diagnostics.find((d) => d.kind === "modal-state");
  if (modal) {
    return {
      blocked: true,
      kind: "modal-state",
      suggestions: [
        "Dismiss or accept the browser dialog if one is visible",
        "Retry the read after the dialog is cleared",
        "If still blocked, run `pw session recreate <name>`",
      ],
    };
  }
  return { blocked: false, kind: null as string | null, suggestions: [] as string[] };
}

// ─── I/O probes ───────────────────────────────────────────────────────────────

function canReadPath(path: string) {
  try { accessSync(path, constants.R_OK); return true; } catch { return false; }
}

function canWritePath(path: string) {
  try { accessSync(path, constants.W_OK); return true; } catch { return false; }
}

export function inspectProfilePath(input?: string): DoctorDiagnostic {
  if (!input) return { kind: "profile-path", status: "skipped", summary: "No profile path provided", details: {} };
  const resolvedPath = expandPath(input);
  const exists = existsSync(resolvedPath);
  const type = exists ? (lstatSync(resolvedPath).isDirectory() ? "directory" : "file") : "missing";
  const writable = exists ? canWritePath(resolvedPath) : canWritePath(resolve(resolvedPath, ".."));
  return {
    kind: "profile-path",
    status: type === "file" || !writable ? "warn" : "ok",
    summary: type === "file" ? "Profile path points to a file" : writable ? "Profile path is usable" : "Profile path is not writable",
    details: { requestedPath: input, resolvedPath, exists, type, writable, usable: type !== "file" && writable },
  };
}

export function inspectStatePath(input?: string): DoctorDiagnostic {
  if (!input) return { kind: "state-path", status: "skipped", summary: "No state path provided", details: {} };
  const resolvedPath = expandPath(input);
  const exists = existsSync(resolvedPath);
  if (!exists) return { kind: "state-path", status: "warn", summary: "State file does not exist", details: { requestedPath: input, resolvedPath, exists } };

  const readable = canReadPath(resolvedPath);
  let validJson = false, cookieCount = 0, originCount = 0, parseError = "";
  if (readable) {
    try {
      const parsed = JSON.parse(readFileSync(resolvedPath, "utf8"));
      validJson = true;
      cookieCount = Array.isArray(parsed.cookies) ? parsed.cookies.length : 0;
      originCount = Array.isArray(parsed.origins) ? parsed.origins.length : 0;
    } catch (error) {
      parseError = error instanceof Error ? error.message : String(error);
    }
  }
  return {
    kind: "state-path",
    status: readable && validJson ? "ok" : "warn",
    summary: readable && validJson ? "State file is readable JSON" : "State file is unreadable or invalid",
    details: { requestedPath: input, resolvedPath, exists, readable, validJson, cookieCount, originCount, ...(parseError ? { parseError } : {}) },
  };
}

export async function probeEndpoint(endpoint?: string): Promise<DoctorDiagnostic> {
  if (!endpoint) return { kind: "endpoint-reachability", status: "skipped", summary: "No endpoint provided", details: {} };

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch (error) {
    return { kind: "endpoint-reachability", status: "warn", summary: "Endpoint is not a valid URL",
      details: { endpoint, error: error instanceof Error ? error.message : String(error) } };
  }

  if (url.protocol === "http:" || url.protocol === "https:") {
    try {
      const response = await fetch(endpoint, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(3000) });
      return { kind: "endpoint-reachability", status: "ok", summary: "HTTP endpoint responded",
        details: { endpoint, protocol: url.protocol, statusCode: response.status, ok: response.ok } };
    } catch (error) {
      return { kind: "endpoint-reachability", status: "warn", summary: "HTTP endpoint did not respond",
        details: { endpoint, protocol: url.protocol, error: error instanceof Error ? error.message : String(error) } };
    }
  }

  if (url.protocol === "ws:" || url.protocol === "wss:") {
    const port = url.port || (url.protocol === "wss:" ? "443" : "80");
    return new Promise((resolveResult) => {
      let settled = false;
      const finish = (diagnostic: DoctorDiagnostic) => { if (settled) return; settled = true; resolveResult(diagnostic); };
      const baseDetails = { endpoint, protocol: url.protocol, host: url.hostname, port: Number(port) };
      const onConnect = (socket: { destroy: () => void }) => {
        socket.destroy();
        finish({ kind: "endpoint-reachability", status: "ok", summary: "WebSocket endpoint accepted a TCP connection", details: baseDetails });
      };
      const socket = url.protocol === "wss:"
        ? connectTls({ host: url.hostname, port: Number(port) }, function(this: { destroy: () => void }) { onConnect(this); })
        : connectNet({ host: url.hostname, port: Number(port) }, function(this: { destroy: () => void }) { onConnect(this); });
      socket.setTimeout(3000, () => { socket.destroy(); finish({ kind: "endpoint-reachability", status: "warn", summary: "WebSocket endpoint timed out", details: baseDetails }); });
      socket.on("error", (error) => { socket.destroy(); finish({ kind: "endpoint-reachability", status: "warn", summary: "WebSocket endpoint is unreachable", details: { ...baseDetails, error: error.message } }); });
    });
  }

  return { kind: "endpoint-reachability", status: "warn", summary: "Unsupported endpoint protocol", details: { endpoint, protocol: url.protocol } };
}

export async function checkPlaywrightBrowsers(): Promise<Array<{ browser: string; installed: boolean; path?: string }>> {
  const browsers = ["chromium", "firefox", "webkit"];
  let browsersPath: string | null = process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== "0"
    ? process.env.PLAYWRIGHT_BROWSERS_PATH : null;

  if (!browsersPath) {
    try {
      const localBrowsers = resolve(process.cwd(), "node_modules/playwright-core/.local-browsers");
      if (existsSync(localBrowsers)) browsersPath = localBrowsers;
    } catch { /* ignore */ }
  }
  if (!browsersPath) {
    const defaultCache = resolve(homedir(), ".cache/ms-playwright");
    if (existsSync(defaultCache)) browsersPath = defaultCache;
  }

  return browsers.map((browser) => {
    if (!browsersPath) return { browser, installed: false };
    try {
      const match = readdirSync(browsersPath).find((e) => e.startsWith(`${browser}-`));
      return match ? { browser, installed: true, path: resolve(browsersPath, match) } : { browser, installed: false };
    } catch {
      return { browser, installed: false };
    }
  });
}

export async function checkDiskSpace(dir: string): Promise<{ availableGB: number; ok: boolean }> {
  const fs = await import("node:fs");
  if (!fs.statfs) return { availableGB: 0, ok: false };
  return new Promise((res, rej) => {
    fs.statfs(dir, (err, stats) => {
      if (err) { rej(err); return; }
      const availableGB = (stats.bavail * stats.bsize) / 1024 ** 3;
      res({ availableGB, ok: availableGB > 1 });
    });
  });
}

export async function inspectEnvironment(cwd?: string): Promise<DoctorDiagnostic> {
  const version = process.version;
  const minimum = "18.15.0";
  const nodeOk = version.slice(1).split(".").map(Number).reduce((ok, n, i, arr) => {
    if (!ok) return false;
    const min = minimum.split(".").map(Number)[i] ?? 0;
    return n > min ? true : n < min ? false : ok;
  }, true);

  const browserChecks = await checkPlaywrightBrowsers();
  const diskCheck = await checkDiskSpace(cwd ?? process.cwd());

  const items: Array<{ label: string; status: DoctorStatus; detail: string }> = [
    { label: "Node.js version", status: nodeOk ? "ok" : "fail", detail: `${version} (required: >= ${minimum})` },
    ...browserChecks.map((b) => ({
      label: `Playwright ${b.browser}`,
      status: (b.installed ? "ok" : "warn") as DoctorStatus,
      detail: b.installed ? `installed at ${b.path ?? ""}` : "not installed",
    })),
    { label: "Disk space", status: diskCheck.ok ? "ok" : "warn", detail: `${diskCheck.availableGB.toFixed(1)} GB available` },
  ];

  const worstStatus = items.reduce<DoctorStatus>((worst, item) => {
    if (item.status === "fail") return "fail";
    if (item.status === "warn" && worst !== "fail") return "warn";
    return worst;
  }, "ok");

  return {
    kind: "environment",
    status: worstStatus,
    summary: worstStatus === "ok" ? "Environment checks passed" : "Environment issues detected",
    details: { items, nodeVersion: { ok: nodeOk, version, minimum }, browsers: browserChecks, diskSpace: diskCheck },
  };
}
