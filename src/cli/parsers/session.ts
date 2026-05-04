import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ActionFailure, isActionFailure } from "#engine/act/element.js";
import {
  MAX_SESSION_NAME_LENGTH,
  parsePageSummary,
  runManagedSessionCommand,
  sessionRoutingError,
} from "#engine/session.js";
import { managedRunCode } from "#engine/shared.js";
import { appendRunEvent, ensureRunDir } from "#store/artifacts.js";
import { printCommandError, type RecoveryKind } from "../output.js";

function domainError(rawMessage: string) {
  const message = rawMessage.startsWith("Error: ")
    ? rawMessage.slice("Error: ".length)
    : rawMessage;
  if (message.startsWith("STATE_TARGET_NOT_FOUND:")) {
    let target: unknown;
    try {
      target = JSON.parse(message.slice("STATE_TARGET_NOT_FOUND:".length));
    } catch {
      /* ignore */
    }
    return {
      code: "STATE_TARGET_NOT_FOUND",
      message: "The state target was not found in the current page.",
      retryable: true,
      suggestions: [
        "Run `pw snapshot -i --session <name>` to inspect current refs",
        "Run `pw locate --session <name> --selector <selector>` to find the element",
      ],
      recovery: { kind: "inspect" as const, commands: ["pw snapshot -i --session <name>"] },
      details: target ? { target } : {},
    };
  }
  if (message.startsWith("READ_TEXT_SELECTOR_NOT_FOUND:")) {
    return {
      code: "READ_TEXT_SELECTOR_NOT_FOUND",
      message: "The selector did not match any element.",
      retryable: true,
      suggestions: ["Run `pw snapshot -i --session <name>` to inspect current state"],
      recovery: { kind: "inspect" as const, commands: ["pw snapshot -i --session <name>"] },
    };
  }
  return null;
}

export function requireSessionName(session?: string): string {
  const sessionName = session?.trim();
  if (!sessionName) throw new Error("SESSION_REQUIRED");
  if (sessionName.length > MAX_SESSION_NAME_LENGTH) {
    throw new Error(`SESSION_NAME_TOO_LONG:${sessionName}:${MAX_SESSION_NAME_LENGTH}`);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionName)) {
    throw new Error(`SESSION_NAME_INVALID:${sessionName}`);
  }
  return sessionName;
}

export function printSessionAwareCommandError(
  command: string,
  error: unknown,
  fallback: {
    code: string;
    message: string;
    suggestions?: string[];
    details?: Record<string, unknown>;
  },
  output?: unknown,
) {
  const message = error instanceof Error ? error.message : String(error);
  const routing = sessionRoutingError(message);
  if (routing) {
    printCommandError(command, routing, output);
    return;
  }
  const domain = domainError(message);
  if (domain) {
    printCommandError(command, domain, output);
    return;
  }
  if (isActionFailure(error)) {
    printCommandError(
      command,
      {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        suggestions: error.suggestions,
        recovery: error.recovery
          ? { kind: error.recovery.kind as RecoveryKind, commands: error.recovery.commands }
          : undefined,
        details: error.details,
      },
      output,
    );
    return;
  }
  const screenshotPath =
    error instanceof Error
      ? (error as unknown as Record<string, unknown>).failureScreenshotPath
      : undefined;
  printCommandError(
    command,
    {
      code: fallback.code,
      message: error instanceof Error ? error.message : fallback.message,
      suggestions: fallback.suggestions,
      details: {
        ...fallback.details,
        ...(screenshotPath ? { failureScreenshotPath: screenshotPath } : {}),
      },
    },
    output,
  );
}

export async function captureFailureScreenshot(
  sessionName: string,
  existingRunDir?: string,
): Promise<string | undefined> {
  try {
    const runDir = existingRunDir ?? (await ensureRunDir(sessionName)).runDir;
    const path = join(runDir, `failure-${Date.now()}.png`);
    await managedRunCode({
      sessionName,
      source: `async page => {
        await page.screenshot(${JSON.stringify({ path, fullPage: true })});
        return JSON.stringify({ path: ${JSON.stringify(path)} });
      }`,
    });
    return path;
  } catch {
    return undefined;
  }
}

export async function withActionFailureScreenshot<T>(
  sessionName: string,
  action: () => Promise<T>,
  command?: string,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    const existingRunDir = isActionFailure(error)
      ? ((error as ActionFailure).details?.run as Record<string, string> | undefined)?.runDir
      : undefined;
    const screenshotPath = await captureFailureScreenshot(sessionName, existingRunDir);
    if (screenshotPath) {
      if (isActionFailure(error)) {
        error.details = { ...error.details, failureScreenshotPath: screenshotPath };
      } else if (error instanceof Error) {
        (error as unknown as Record<string, unknown>).failureScreenshotPath = screenshotPath;
      }
    }
    if (command) {
      await recordCommandFailure(command, sessionName, error, screenshotPath, existingRunDir).catch(
        () => {},
      );
    }
    throw error;
  }
}

async function recordCommandFailure(
  command: string,
  sessionName: string,
  error: unknown,
  screenshotPath?: string,
  existingRunDir?: string,
) {
  const runDir = existingRunDir ?? (await ensureRunDir(sessionName)).runDir;
  const code = isActionFailure(error) ? error.code : `${command.toUpperCase()}_FAILED`;
  const message = error instanceof Error ? error.message : String(error);
  await appendRunEvent(runDir, {
    ts: new Date().toISOString(),
    command,
    sessionName: sessionName ?? null,
    status: "failed",
    failed: true,
    failure: {
      code,
      message,
      retryable: isActionFailure(error) ? error.retryable : null,
      suggestions: isActionFailure(error) ? error.suggestions : [],
      details: isActionFailure(error) ? (error.details ?? null) : null,
    },
    ...(screenshotPath ? { failureScreenshotPath: screenshotPath } : {}),
  });
}

type RawAttachTarget =
  | { endpoint: string; resolvedVia: "ws-endpoint" }
  | { endpoint: string; resolvedVia: "browser-url" }
  | { endpoint: string; resolvedVia: "cdp" }
  | { endpoint: string; resolvedVia: "argument" };

type ResolvedAttachTarget =
  | { endpoint: string; resolvedVia: "ws-endpoint" | "argument" | "attachable-id" }
  | { endpoint: string; resolvedVia: "browser-url" | "cdp"; browserURL: string };

type AttachBridgeRegistry = {
  targets?: Array<{
    browserURL?: string;
    cdpPort?: number;
    wsEndpoint?: string;
    cdpWebSocketDebuggerUrl?: string;
  }>;
};

const ATTACH_BRIDGE_REGISTRY_PATH = join(tmpdir(), "pwcli-attach-target-registry.json");

function normalizeBrowserURL(browserURL: string) {
  try {
    const url = new URL(browserURL);
    if (url.hostname === "localhost") url.hostname = "127.0.0.1";
    return url.toString().replace(/\/$/, "");
  } catch {
    return browserURL.replace(/\/$/, "");
  }
}

function parseBrowserPort(browserURL: string) {
  try {
    const url = new URL(browserURL);
    return url.port ? Number(url.port) : undefined;
  } catch {
    return undefined;
  }
}

function normalizeAttachMetadataEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    if (url.hostname === "localhost") url.hostname = "127.0.0.1";
    return url.toString();
  } catch {
    return endpoint;
  }
}

async function readAttachBridgeRegistry() {
  try {
    const text = await readFile(ATTACH_BRIDGE_REGISTRY_PATH, "utf8");
    const parsed = JSON.parse(text) as AttachBridgeRegistry;
    return Array.isArray(parsed.targets) ? parsed.targets : [];
  } catch {
    return [];
  }
}

async function readBrowserMetadata(browserURL: string) {
  const normalizedBrowserURL = normalizeBrowserURL(browserURL);
  const response = await fetch(`${normalizedBrowserURL}/json/version`, {
    method: "GET",
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) {
    throw new Error(`attach could not read browser metadata from ${normalizedBrowserURL}`);
  }
  return {
    browserURL: normalizedBrowserURL,
    json: (await response.json()) as { webSocketDebuggerUrl?: string },
  };
}

async function resolveBrowserWsEndpoint(browserURL: string) {
  const { browserURL: normalizedBrowserURL, json } = await readBrowserMetadata(browserURL);
  const cdpWebSocketDebuggerUrl = json.webSocketDebuggerUrl?.trim();
  const normalizedCdpWebSocketDebuggerUrl = cdpWebSocketDebuggerUrl
    ? normalizeAttachMetadataEndpoint(cdpWebSocketDebuggerUrl)
    : undefined;
  const cdpPort = parseBrowserPort(normalizedBrowserURL);
  if (!normalizedCdpWebSocketDebuggerUrl) {
    throw new Error(
      `attach did not receive webSocketDebuggerUrl from ${normalizedBrowserURL}/json/version`,
    );
  }
  const registry = await readAttachBridgeRegistry();
  const registryMatch = registry.find((target) => {
    const browserURLMatches = target.browserURL === normalizedBrowserURL;
    const cdpPortMatches =
      cdpPort !== undefined && Number.isInteger(target.cdpPort) && target.cdpPort === cdpPort;
    if (!browserURLMatches && !cdpPortMatches) return false;
    if (!target.wsEndpoint?.trim()) return false;
    return !(
      target.cdpWebSocketDebuggerUrl?.trim() &&
      normalizeAttachMetadataEndpoint(target.cdpWebSocketDebuggerUrl.trim()) !==
        normalizedCdpWebSocketDebuggerUrl
    );
  });
  const wsEndpoint = registryMatch?.wsEndpoint?.trim();
  if (!wsEndpoint) {
    throw new Error(
      `ATTACH_SUBSTRATE_UNAVAILABLE: ${normalizedBrowserURL} exposes CDP metadata but no Playwright ws bridge. Start a cooperating target such as \`node test/fixtures/targets/attach-target.js\`, or attach with \`--ws-endpoint\`.`,
    );
  }
  return wsEndpoint;
}

export async function resolveAttachTarget(
  endpoint: string | undefined,
  options: { wsEndpoint?: string; browserUrl?: string; cdp?: string },
): Promise<ResolvedAttachTarget> {
  const candidates = [
    options.wsEndpoint
      ? { endpoint: options.wsEndpoint, resolvedVia: "ws-endpoint" as const }
      : null,
    options.browserUrl
      ? { endpoint: options.browserUrl, resolvedVia: "browser-url" as const }
      : null,
    options.cdp
      ? { endpoint: `http://127.0.0.1:${options.cdp}`, resolvedVia: "cdp" as const }
      : null,
    endpoint ? { endpoint, resolvedVia: "argument" as const } : null,
  ].filter(Boolean) as RawAttachTarget[];
  if (candidates.length === 0) {
    throw new Error(
      "attach requires an endpoint, --ws-endpoint <url>, --browser-url <url>, or --cdp <port>",
    );
  }
  if (candidates.length > 1) throw new Error("attach accepts exactly one target source");
  const target = candidates[0];
  if (target.resolvedVia === "browser-url" || target.resolvedVia === "cdp") {
    const wsEndpoint = await resolveBrowserWsEndpoint(target.endpoint);
    return {
      endpoint: wsEndpoint,
      resolvedVia: target.resolvedVia,
      browserURL: normalizeBrowserURL(target.endpoint),
    };
  }
  return target;
}

export async function attachManagedSession(options: {
  sessionName: string;
  endpoint: string;
  resolvedVia: string;
  browserURL?: string;
}) {
  const probe = await runManagedSessionCommand(
    { _: ["snapshot"] },
    {
      sessionName: options.sessionName,
      reset: true,
      endpoint: options.endpoint,
      createIfMissing: true,
    },
  );
  const page = parsePageSummary(probe.text);
  return {
    page,
    session: {
      scope: "managed",
      name: probe.sessionName,
      default: probe.sessionName === "default",
    },
    data: {
      attached: true,
      endpoint: options.endpoint,
      resolvedVia: options.resolvedVia,
      ...(options.browserURL ? { browserURL: options.browserURL } : {}),
      currentPageAvailable: Boolean(page),
    },
  };
}
