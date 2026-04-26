import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runManagedSessionCommand } from "../../domain/session/service.js";
import { parsePageSummary } from "../../infra/playwright/output-parsers.js";

type RawAttachTarget =
  | { endpoint: string; resolvedVia: "ws-endpoint" }
  | { endpoint: string; resolvedVia: "browser-url" }
  | { endpoint: string; resolvedVia: "cdp" }
  | { endpoint: string; resolvedVia: "argument" };

type ResolvedAttachTarget =
  | { endpoint: string; resolvedVia: "ws-endpoint" | "argument" }
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
    if (url.hostname === "localhost") {
      url.hostname = "127.0.0.1";
    }
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
    if (url.hostname === "localhost") {
      url.hostname = "127.0.0.1";
    }
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
    if (!browserURLMatches && !cdpPortMatches) {
      return false;
    }
    if (!target.wsEndpoint?.trim()) {
      return false;
    }
    if (
      target.cdpWebSocketDebuggerUrl?.trim() &&
      normalizeAttachMetadataEndpoint(target.cdpWebSocketDebuggerUrl.trim()) !==
        normalizedCdpWebSocketDebuggerUrl
    ) {
      return false;
    }
    return true;
  });

  const wsEndpoint = registryMatch?.wsEndpoint?.trim();
  if (!wsEndpoint) {
    throw new Error(
      `ATTACH_SUBSTRATE_UNAVAILABLE: ${normalizedBrowserURL} exposes CDP metadata but no Playwright ws bridge. Start a cooperating target such as \`node scripts/manual/attach-target.js\`, or attach with \`--ws-endpoint\`.`,
    );
  }
  return wsEndpoint;
}

export async function resolveAttachTarget(
  endpoint: string | undefined,
  options: {
    wsEndpoint?: string;
    browserUrl?: string;
    cdp?: string;
  },
): Promise<ResolvedAttachTarget> {
  const candidates = [
    options.wsEndpoint
      ? { endpoint: options.wsEndpoint, resolvedVia: "ws-endpoint" as const }
      : null,
    options.browserUrl
      ? { endpoint: options.browserUrl, resolvedVia: "browser-url" as const }
      : null,
    options.cdp
      ? {
          endpoint: `http://127.0.0.1:${options.cdp}`,
          resolvedVia: "cdp" as const,
        }
      : null,
    endpoint ? { endpoint, resolvedVia: "argument" as const } : null,
  ].filter(Boolean) as RawAttachTarget[];

  if (candidates.length === 0) {
    throw new Error(
      "attach requires an endpoint, --ws-endpoint <url>, --browser-url <url>, or --cdp <port>",
    );
  }
  if (candidates.length > 1) {
    throw new Error("attach accepts exactly one target source");
  }
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
    {
      _: ["snapshot"],
    },
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
