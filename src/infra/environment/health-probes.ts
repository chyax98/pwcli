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
import type { DoctorDiagnostic, DoctorStatus } from "../../domain/environment/health-checks.js";
import { expandPath } from "../../domain/environment/health-checks.js";

function canReadPath(path: string) {
  try {
    accessSync(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function canWritePath(path: string) {
  try {
    accessSync(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

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
        if (settled) return;
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
              { host: url.hostname, port: Number(port) },
              function onSecureConnect() {
                onConnect(this);
              },
            )
          : connectNet(
              { host: url.hostname, port: Number(port) },
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
          details: { endpoint, protocol: url.protocol, host: url.hostname, port: Number(port) },
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
    details: { endpoint, protocol: url.protocol },
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
  const minimum = "18.15.0";
  const ok = compareSemver(version.slice(1), minimum) >= 0;
  return { ok, version, minimum };
}

export async function checkPlaywrightBrowsers(): Promise<
  Array<{ browser: string; installed: boolean; path?: string }>
> {
  const browsers = ["chromium", "firefox", "webkit"];
  const results: Array<{ browser: string; installed: boolean; path?: string }> = [];

  let browsersPath: string | null = null;
  const envPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (envPath && envPath !== "0") {
    browsersPath = envPath;
  } else {
    try {
      const pwCorePkg = resolve(process.cwd(), "node_modules/playwright-core/package.json");
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
        results.push({ browser, installed: true, path: resolve(browsersPath, match) });
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
    return { availableGB: 0, ok: false };
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

export async function inspectEnvironment(cwd?: string): Promise<DoctorDiagnostic> {
  const nodeCheck = await checkNodeVersion();
  const browserChecks = await checkPlaywrightBrowsers();
  const diskCheck = await checkDiskSpace(cwd ?? process.cwd());

  const items: Array<{ label: string; status: DoctorStatus; detail: string }> = [
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
      worstStatus === "ok" ? "Environment checks passed" : "Environment issues detected",
    details: {
      items,
      nodeVersion: nodeCheck,
      browsers: browserChecks,
      diskSpace: diskCheck,
    },
  };
}
