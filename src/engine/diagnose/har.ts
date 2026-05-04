import { resolve } from "node:path";
import { managedRunCode, stateAccessPrelude } from "../shared.js";

export class HarCaptureUnsupportedError extends Error {
  readonly code = "UNSUPPORTED_HAR_CAPTURE";
  readonly details: Record<string, unknown>;

  constructor(action: "start" | "stop", requestedPath?: string) {
    super(
      "HAR recording is not supported on an already-open managed BrowserContext. Use network/diagnostics/trace for 1.0 evidence, or use har replay with a pre-recorded HAR for deterministic network stubbing.",
    );
    this.name = "HarCaptureUnsupportedError";
    this.details = {
      action,
      supported: false,
      reason: "PLAYWRIGHT_RECORD_HAR_REQUIRES_CONTEXT_CREATION",
      ...(requestedPath ? { requestedPath: resolve(requestedPath) } : {}),
    };
  }
}

export async function managedHar(
  action: "start" | "stop",
  options?: { path?: string; sessionName?: string },
): Promise<never> {
  throw new HarCaptureUnsupportedError(action, options?.path);
}

export async function managedHarReplay(options: { filePath: string; sessionName?: string }) {
  const resolvedPath = resolve(options.filePath);
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      ${stateAccessPrelude()}
      const previousRoutes = new Set(context._routes || []);
      await context.routeFromHAR(${JSON.stringify(resolvedPath)}, {
        notFound: 'abort',
      });
      const harRoutes = (context._routes || []).filter(r => !previousRoutes.has(r));
      state.harReplay = {
        active: true,
        file: ${JSON.stringify(resolvedPath)},
        startedAt: new Date().toISOString(),
        harRoutes,
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
      ...(parsed as Record<string, unknown>),
    },
  };
}

export async function managedHarReplayStop(options: { sessionName?: string }) {
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      ${stateAccessPrelude()}
      const harRoutes = state.harReplay?.harRoutes || [];
      let clearedCount = 0;
      if (harRoutes.length && context._routes) {
        for (const routeHandler of harRoutes) {
          try {
            await context.unroute(routeHandler.url, routeHandler.handler);
            clearedCount++;
          } catch (e) {}
        }
      }
      if (typeof context._disposeHarRouters === 'function') {
        context._disposeHarRouters();
      }
      const usedFallback = clearedCount === 0;
      // Do not call unrouteAll() or reset state.routes — that would destroy unrelated pw route add mocks.
      // If HAR routes could not be individually cleared, record a limitation and leave other routes intact.
      state.harReplay = {
        active: false,
        stoppedAt: new Date().toISOString(),
      };
      return JSON.stringify({
        replayActive: false,
        ...(usedFallback ? { limitation: 'HAR replay routes could not be individually removed; replay may still be active. Use pw session recreate to fully reset routing.' } : {}),
      });
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
