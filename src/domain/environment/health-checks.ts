import {
  accessSync,
  constants,
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  statfs,
} from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { connect as connectNet } from "node:net";
import { connect as connectTls } from "node:tls";

export type DoctorStatus = "ok" | "warn" | "fail" | "skipped";

export type DoctorDiagnostic = {
  kind: string;
  status: DoctorStatus;
  summary: string;
  details: Record<string, unknown>;
};

// Value coercions (aliases for diagnostics/helpers.ts equivalents)
export function objectRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

export function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// Path helpers
export function expandPath(input: string) {
  if (input === "~") {
    return homedir();
  }
  if (input.startsWith("~/")) {
    return resolve(homedir(), input.slice(2));
  }
  return resolve(input);
}

export function canReadPath(path: string) {
  try {
    accessSync(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export function canWritePath(path: string) {
  try {
    accessSync(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

// Profile path inspection
export function inspectProfilePath(input?: string): DoctorDiagnostic {
  if (!input) {
    return {
      kind: "profile-path",
      status: "skipped",
      summary: "No profile path provided",
      details: {},
    };
  }
  const resolvedPath = expandPath(input);
  const exists = existsSync(resolvedPath);
  const type = exists ? (lstatSync(resolvedPath).isDirectory() ? "directory" : "file") : "missing";
  const writable = exists ? canWritePath(resolvedPath) : canWritePath(resolve(resolvedPath, ".."));
  return {
    kind: "profile-path",
    status: type === "file" || !writable ? "warn" : "ok",
    summary:
      type === "file"
        ? "Profile path points to a file"
        : writable
          ? "Profile path is usable"
          : "Profile path is not writable",
    details: {
      requestedPath: input,
      resolvedPath,
      exists,
      type,
      writable,
      usable: type !== "file" && writable,
    },
  };
}

// State path inspection
export function inspectStatePath(input?: string): DoctorDiagnostic {
  if (!input) {
    return {
      kind: "state-path",
      status: "skipped",
      summary: "No state path provided",
      details: {},
    };
  }
  const resolvedPath = expandPath(input);
  const exists = existsSync(resolvedPath);
  if (!exists) {
    return {
      kind: "state-path",
      status: "warn",
      summary: "State file does not exist",
      details: {
        requestedPath: input,
        resolvedPath,
        exists,
      },
    };
  }

  const readable = canReadPath(resolvedPath);
  let validJson = false;
  let cookieCount = 0;
  let originCount = 0;
  let parseError = "";
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
    summary:
      readable && validJson ? "State file is readable JSON" : "State file is unreadable or invalid",
    details: {
      requestedPath: input,
      resolvedPath,
      exists,
      readable,
      validJson,
      cookieCount,
      originCount,
      ...(parseError ? { parseError } : {}),
    },
  };
}

// Endpoint reachability probe
export async function probeEndpoint(endpoint?: string): Promise<DoctorDiagnostic> {
  if (!endpoint) {
    return {
      kind: "endpoint-reachability",
      status: "skipped",
      summary: "No endpoint provided",
      details: {},
    };
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch (error) {
    return {
      kind: "endpoint-reachability",
      status: "warn",
      summary: "Endpoint is not a valid URL",
      details: {
        endpoint,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }

  if (url.protocol === "http:" || url.protocol === "https:") {
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(3000),
      });
      return {
        kind: "endpoint-reachability",
        status: "ok",
        summary: "HTTP endpoint responded",
        details: {
          endpoint,
          protocol: url.protocol,
          statusCode: response.status,
          ok: response.ok,
        },
      };
    } catch (error) {
      return {
        kind: "endpoint-reachability",
        status: "warn",
        summary: "HTTP endpoint did not respond",
        details: {
          endpoint,
          protocol: url.protocol,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  if (url.protocol === "ws:" || url.protocol === "wss:") {
    const port = url.port || (url.protocol === "wss:" ? "443" : "80");
    return await new Promise((resolveResult) => {
      let settled = false;
      const finish = (diagnostic: DoctorDiagnostic) => {
        if (settled) {
          return;
        }
        settled = true;
        resolveResult(diagnostic);
      };
      const onConnect = (socket: { destroy: () => void }) => {
        socket.destroy();
        finish({
          kind: "endpoint-reachability",
          status: "ok",
          summary: "WebSocket endpoint accepted a TCP connection",
          details: {
            endpoint,
            protocol: url.protocol,
            host: url.hostname,
            port: Number(port),
          },
        });
      };
      const socket =
        url.protocol === "wss:"
          ? connectTls(
              {
                host: url.hostname,
                port: Number(port),
              },
              function onSecureConnect() {
                onConnect(this);
              },
            )
          : connectNet(
              {
                host: url.hostname,
                port: Number(port),
              },
              function onNetConnect() {
                onConnect(this);
              },
            );
      socket.setTimeout(3000, () => {
        socket.destroy();
        finish({
          kind: "endpoint-reachability",
          status: "warn",
          summary: "WebSocket endpoint timed out",
          details: {
            endpoint,
            protocol: url.protocol,
            host: url.hostname,
            port: Number(port),
          },
        });
      });
      socket.on("error", (error) => {
        socket.destroy();
        finish({
          kind: "endpoint-reachability",
          status: "warn",
          summary: "WebSocket endpoint is unreachable",
          details: {
            endpoint,
            protocol: url.protocol,
            host: url.hostname,
            port: Number(port),
            error: error.message,
          },
        });
      });
    });
  }

  return {
    kind: "endpoint-reachability",
    status: "warn",
    summary: "Unsupported endpoint protocol",
    details: {
      endpoint,
      protocol: url.protocol,
    },
  };
}

function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

export async function checkNodeVersion(): Promise<{
  ok: boolean;
  version: string;
  minimum: string;
}> {
  const version = process.version;
  const minimum = "18.0.0";
  const ok = compareSemver(version.slice(1), minimum) >= 0;
  return { ok, version, minimum };
}

export async function checkPlaywrightBrowsers(): Promise<
  Array<{ browser: string; installed: boolean; path?: string }>
> {
  const browsers = ["chromium", "firefox", "webkit"];
  const results: Array<{ browser: string; installed: boolean; path?: string }> =
    [];

  let browsersPath: string | null = null;
  const envPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (envPath && envPath !== "0") {
    browsersPath = envPath;
  } else {
    try {
      const pwCorePkg = resolve(
        process.cwd(),
        "node_modules/playwright-core/package.json",
      );
      if (existsSync(pwCorePkg)) {
        const localBrowsers = resolve(pwCorePkg, "..", ".local-browsers");
        if (existsSync(localBrowsers)) {
          browsersPath = localBrowsers;
        }
      }
    } catch {
      // ignore
    }
    if (!browsersPath) {
      const defaultCache = resolve(homedir(), ".cache/ms-playwright");
      if (existsSync(defaultCache)) {
        browsersPath = defaultCache;
      }
    }
  }

  for (const browser of browsers) {
    if (!browsersPath) {
      results.push({ browser, installed: false });
      continue;
    }
    try {
      const entries = readdirSync(browsersPath);
      const match = entries.find((e) => e.startsWith(`${browser}-`));
      if (match) {
        results.push({
          browser,
          installed: true,
          path: resolve(browsersPath, match),
        });
      } else {
        results.push({ browser, installed: false });
      }
    } catch {
      results.push({ browser, installed: false });
    }
  }

  return results;
}

export async function checkDiskSpace(
  dir: string,
): Promise<{ availableGB: number; ok: boolean }> {
  const fs = await import("node:fs");
  const statfs = fs.statfs;
  if (!statfs) {
    throw new Error("checkDiskSpace requires Node.js >= 18.15 (statfs is unavailable)");
  }
  return new Promise((resolve, reject) => {
    statfs(dir, (err, stats) => {
      if (err) {
        reject(err);
        return;
      }
      const availableGB = (stats.bavail * stats.bsize) / 1024 ** 3;
      resolve({ availableGB, ok: availableGB > 1 });
    });
  });
}

export async function inspectEnvironment(
  cwd?: string,
): Promise<DoctorDiagnostic> {
  const nodeCheck = await checkNodeVersion();
  const browserChecks = await checkPlaywrightBrowsers();
  const diskCheck = await checkDiskSpace(cwd ?? process.cwd());

  const items: Array<{ label: string; status: DoctorStatus; detail: string }> =
    [
      {
        label: "Node.js version",
        status: nodeCheck.ok ? "ok" : "fail",
        detail: `${nodeCheck.version} (required: >= ${nodeCheck.minimum})`,
      },
      ...browserChecks.map((b) => ({
        label: `Playwright ${b.browser}`,
        status: (b.installed ? "ok" : "warn") as DoctorStatus,
        detail: b.installed ? `installed at ${b.path}` : "not installed",
      })),
      {
        label: "Disk space",
        status: diskCheck.ok ? "ok" : "warn",
        detail: `${diskCheck.availableGB.toFixed(1)} GB available`,
      },
    ];

  const worstStatus = items.reduce<DoctorStatus>((worst, item) => {
    if (item.status === "fail") return "fail";
    if (item.status === "warn" && worst !== "fail") return "warn";
    return worst;
  }, "ok");

  return {
    kind: "environment",
    status: worstStatus,
    summary:
      worstStatus === "ok"
        ? "Environment checks passed"
        : "Environment issues detected",
    details: {
      items,
      nodeVersion: nodeCheck,
      browsers: browserChecks,
      diskSpace: diskCheck,
    },
  };
}

// Diagnostics summarization
export function summarizeDiagnostics(diagnostics: DoctorDiagnostic[]) {
  return diagnostics.reduce(
    (summary, diagnostic) => {
      summary[diagnostic.status] += 1;
      return summary;
    },
    { ok: 0, warn: 0, fail: 0, skipped: 0 },
  );
}

export function compactDoctorDiagnostic(diagnostic: DoctorDiagnostic): DoctorDiagnostic {
  const details = diagnostic.details ?? {};
  switch (diagnostic.kind) {
    case "session-substrate": {
      const probe = objectRecord(details.probe);
      const page = objectRecord(probe.page);
      return {
        ...diagnostic,
        details: {
          requestedSession: stringValue(details.requestedSession),
          alive: details.alive === true,
          socketReachable: probe.reachable === true,
          page: {
            url: stringValue(page.url),
            title: stringValue(page.title),
          },
        },
      };
    }
    case "observe-status": {
      const workspace = objectRecord(details.workspace);
      const pageErrors = objectRecord(details.pageErrors);
      const routes = objectRecord(details.routes);
      const trace = objectRecord(details.trace);
      const bootstrap = objectRecord(details.bootstrap);
      return {
        ...diagnostic,
        details: {
          sessionName: stringValue(details.sessionName),
          page: {
            url: stringValue(objectRecord(details.page).url),
            title: stringValue(objectRecord(details.page).title),
          },
          workspace: {
            pageCount: numberValue(workspace.pageCount) ?? 0,
            currentPageId: stringValue(workspace.currentPageId),
          },
          routes: {
            count: numberValue(routes.count) ?? 0,
          },
          pageErrors: {
            visibleCount: numberValue(pageErrors.visibleCount) ?? 0,
          },
          trace: {
            active: trace.active === true,
          },
          bootstrap: {
            applied: bootstrap.applied === true,
          },
        },
      };
    }
    case "modal-state":
      return {
        ...diagnostic,
        details: {
          sessionName: stringValue(details.sessionName),
          code: stringValue(details.code),
        },
      };
    case "auth-provider-resolution":
      return {
        ...diagnostic,
        details: {
          requestedProvider: stringValue(details.requestedProvider),
          resolved: details.resolved === true,
          discoveredCount: numberValue(details.discoveredCount) ?? 0,
        },
      };
    case "profile-path":
      return {
        ...diagnostic,
        details: {
          requestedPath: stringValue(details.requestedPath),
          resolvedPath: stringValue(details.resolvedPath),
          exists: details.exists === true,
          writable: details.writable === true,
          usable: details.usable === true,
        },
      };
    case "state-path":
      return {
        ...diagnostic,
        details: {
          requestedPath: stringValue(details.requestedPath),
          resolvedPath: stringValue(details.resolvedPath),
          exists: details.exists === true,
          readable: details.readable === true,
          validJson: details.validJson === true,
          cookieCount: numberValue(details.cookieCount) ?? 0,
          originCount: numberValue(details.originCount) ?? 0,
          ...(stringValue(details.parseError)
            ? { parseError: stringValue(details.parseError) }
            : {}),
        },
      };
    case "endpoint-reachability":
      return {
        ...diagnostic,
        details: {
          endpoint: stringValue(details.endpoint),
          protocol: stringValue(details.protocol),
          statusCode: numberValue(details.statusCode),
          host: stringValue(details.host),
          port: numberValue(details.port),
          ...(stringValue(details.error) ? { error: stringValue(details.error) } : {}),
        },
      };
    case "bootstrap-config":
      return {
        ...diagnostic,
        details: {
          sessionName: stringValue(details.sessionName),
          bootstrapConfigMissing: details.bootstrapConfigMissing === true,
          initScriptCount: numberValue(details.initScriptCount) ?? 0,
          appliedAt: stringValue(details.appliedAt),
        },
      };
    case "environment": {
      const items = (details.items ?? []) as Array<{
        label: string;
        status: DoctorStatus;
        detail: string;
      }>;
      const filtered = items.filter((item) => item.status !== "ok");
      return {
        ...diagnostic,
        status: filtered.some((i) => i.status === "fail")
          ? "fail"
          : filtered.length > 0
            ? "warn"
            : "ok",
        summary:
          filtered.length > 0
            ? "Environment issues detected"
            : "Environment checks passed",
        details: {
          items: filtered,
        },
      };
    }
    default:
      return diagnostic;
  }
}

export function doctorRecovery(diagnostics: DoctorDiagnostic[]) {
  const modal = diagnostics.find((diagnostic) => diagnostic.kind === "modal-state");
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
  return {
    blocked: false,
    kind: null,
    suggestions: [],
  };
}
