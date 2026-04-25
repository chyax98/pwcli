import { runManagedSessionCommand } from "../session/cli-client.js";
import { parsePageSummary } from "../session/output-parsers.js";

type RawAttachTarget =
  | { endpoint: string; resolvedVia: "ws-endpoint" }
  | { endpoint: string; resolvedVia: "browser-url" }
  | { endpoint: string; resolvedVia: "cdp" }
  | { endpoint: string; resolvedVia: "argument" };

type ResolvedAttachTarget =
  | { endpoint: string; resolvedVia: "ws-endpoint" | "argument" }
  | { endpoint: string; resolvedVia: "browser-url" | "cdp"; browserURL: string };

async function resolveBrowserWsEndpoint(browserURL: string) {
  const response = await fetch(`${browserURL.replace(/\/$/, "")}/json/version`, {
    method: "GET",
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) {
    throw new Error(`attach could not read browser metadata from ${browserURL}`);
  }
  const json = (await response.json()) as { webSocketDebuggerUrl?: string };
  const wsEndpoint = json.webSocketDebuggerUrl?.trim();
  if (!wsEndpoint) {
    throw new Error(`attach did not receive webSocketDebuggerUrl from ${browserURL}`);
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
) : Promise<ResolvedAttachTarget> {
  const candidates = [
    options.wsEndpoint ? { endpoint: options.wsEndpoint, resolvedVia: "ws-endpoint" as const } : null,
    options.browserUrl ? { endpoint: options.browserUrl, resolvedVia: "browser-url" as const } : null,
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
    await resolveBrowserWsEndpoint(target.endpoint);
    throw new Error(
      `${target.resolvedVia.toUpperCase()}_ATTACH_NOT_SUPPORTED: current managed session substrate only supports --ws-endpoint`,
    );
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
