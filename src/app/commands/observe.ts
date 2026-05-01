import type { Command } from "commander";
import { managedObserveStatus } from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

function compactObserveStatus(result: Awaited<ReturnType<typeof managedObserveStatus>>) {
  const status =
    result.data?.status && typeof result.data.status === "object" ? result.data.status : {};
  const workspace =
    status.workspace && typeof status.workspace === "object" ? status.workspace : {};
  const dialogs = status.dialogs && typeof status.dialogs === "object" ? status.dialogs : {};
  const consoleSummary = status.console && typeof status.console === "object" ? status.console : {};
  const networkSummary = status.network && typeof status.network === "object" ? status.network : {};
  const routeSummary = status.routes && typeof status.routes === "object" ? status.routes : {};
  const pageErrors =
    status.pageErrors && typeof status.pageErrors === "object" ? status.pageErrors : {};
  const trace = status.trace && typeof status.trace === "object" ? status.trace : {};
  const har = status.har && typeof status.har === "object" ? status.har : {};
  const bootstrap =
    status.bootstrap && typeof status.bootstrap === "object" ? status.bootstrap : {};
  const stream = status.stream && typeof status.stream === "object" ? status.stream : {};

  const lastConsole =
    consoleSummary.last && typeof consoleSummary.last === "object"
      ? {
          timestamp:
            typeof consoleSummary.last.timestamp === "string"
              ? consoleSummary.last.timestamp
              : null,
          level: typeof consoleSummary.last.level === "string" ? consoleSummary.last.level : null,
          text: typeof consoleSummary.last.text === "string" ? consoleSummary.last.text : null,
        }
      : null;
  const lastNetwork =
    networkSummary.last && typeof networkSummary.last === "object"
      ? {
          timestamp:
            typeof networkSummary.last.timestamp === "string"
              ? networkSummary.last.timestamp
              : null,
          kind:
            typeof networkSummary.last.kind === "string"
              ? networkSummary.last.kind
              : typeof networkSummary.last.event === "string"
                ? networkSummary.last.event
                : null,
          method:
            typeof networkSummary.last.method === "string" ? networkSummary.last.method : null,
          url: typeof networkSummary.last.url === "string" ? networkSummary.last.url : null,
          status:
            typeof networkSummary.last.status === "number" ? networkSummary.last.status : null,
          failureText:
            typeof networkSummary.last.failureText === "string"
              ? networkSummary.last.failureText
              : null,
        }
      : null;
  const lastPageError =
    pageErrors.last && typeof pageErrors.last === "object"
      ? {
          timestamp:
            typeof pageErrors.last.timestamp === "string" ? pageErrors.last.timestamp : null,
          text: typeof pageErrors.last.text === "string" ? pageErrors.last.text : null,
        }
      : null;

  return {
    session: result.session,
    page: result.page,
    data: {
      summary: {
        pageCount: typeof workspace.pageCount === "number" ? workspace.pageCount : 0,
        currentPageId: typeof workspace.currentPageId === "string" ? workspace.currentPageId : null,
        currentNavigationId:
          typeof workspace.currentNavigationId === "string" ? workspace.currentNavigationId : null,
        dialogCount: typeof dialogs.count === "number" ? dialogs.count : 0,
        routeCount: typeof routeSummary.count === "number" ? routeSummary.count : 0,
        consoleTotal: typeof consoleSummary.total === "number" ? consoleSummary.total : 0,
        networkTotal: typeof networkSummary.total === "number" ? networkSummary.total : 0,
        requestCount: typeof networkSummary.requests === "number" ? networkSummary.requests : 0,
        responseCount: typeof networkSummary.responses === "number" ? networkSummary.responses : 0,
        failedRequestCount:
          typeof networkSummary.failures === "number" ? networkSummary.failures : 0,
        pageErrorVisibleCount:
          typeof pageErrors.visibleCount === "number" ? pageErrors.visibleCount : 0,
        traceActive: trace.active === true,
        bootstrapApplied: bootstrap.applied === true,
        streamSupported: stream.supported === true,
      },
      currentPage: result.page,
      dialogs: {
        count: typeof dialogs.count === "number" ? dialogs.count : 0,
        limitation: typeof dialogs.limitation === "string" ? dialogs.limitation : undefined,
      },
      routes: {
        count: typeof routeSummary.count === "number" ? routeSummary.count : 0,
      },
      pageErrors: {
        visibleCount: typeof pageErrors.visibleCount === "number" ? pageErrors.visibleCount : 0,
        last: lastPageError,
      },
      console: {
        total: typeof consoleSummary.total === "number" ? consoleSummary.total : 0,
        last: lastConsole,
      },
      network: {
        total: typeof networkSummary.total === "number" ? networkSummary.total : 0,
        failures: typeof networkSummary.failures === "number" ? networkSummary.failures : 0,
        last: lastNetwork,
      },
      trace: {
        supported: trace.supported !== false,
        active: trace.active === true,
      },
      har: {
        supported: har.supported === true,
        active: har.active === true,
        ...(typeof har.limitation === "string" ? { limitation: har.limitation } : {}),
      },
      bootstrap: {
        applied: bootstrap.applied === true,
        initScriptCount:
          typeof bootstrap.initScriptCount === "number" ? bootstrap.initScriptCount : 0,
        headersApplied: bootstrap.headersApplied === true,
      },
    },
  };
}

export function registerObserveCommand(program: Command): void {
  addSessionOption(
    program
      .command("observe <action>")
      .description("Inspect workspace and diagnostics status for a named managed session")
      .option("--verbose", "Return the full status payload instead of the compact default"),
  ).action(async (action: string, options: { session?: string; verbose?: boolean }) => {
    try {
      const sessionName = requireSessionName(options);
      if (action !== "status") {
        throw new Error("observe currently supports status only");
      }
      const result = await managedObserveStatus({ sessionName });
      printCommandResult("observe", options.verbose ? result : compactObserveStatus(result));
    } catch (error) {
      printSessionAwareCommandError("observe", error, {
        code: "OBSERVE_FAILED",
        message: "observe failed",
        suggestions: [
          "Use `pw observe --session bug-a status` to inspect current workspace and diagnostics state",
        ],
      });
      process.exitCode = 1;
    }
  });
}
