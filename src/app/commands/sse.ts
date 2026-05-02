import type { Command } from "commander";
import { managedDiagnosticsExport } from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerSseCommand(program: Command): void {
  addSessionOption(
    program
      .command("sse")
      .description("Show captured SSE (Server-Sent Events) records for a session")
      .option("--since <time>", "Show records at or after this ISO timestamp")
      .option("--limit <n>", "Maximum number of records to show", "50")
      .option("--url <pattern>", "Filter by URL substring"),
  ).action(
    async (options: {
      session?: string;
      since?: string;
      limit?: string;
      url?: string;
    }) => {
      try {
        const sessionName = requireSessionName(options);
        const exported = await managedDiagnosticsExport({ sessionName });
        const allRecords: unknown[] = Array.isArray(
          (exported.data as Record<string, unknown>).sse,
        )
          ? ((exported.data as Record<string, unknown>).sse as unknown[])
          : [];

        const sinceFilter = options.since?.trim() || "";
        const sinceTime = sinceFilter ? Date.parse(sinceFilter) : NaN;
        const urlFilter = options.url?.trim() || "";
        const limit = Math.max(1, Number(options.limit) || 50);

        const filtered = allRecords.filter((item) => {
          const record = item as Record<string, unknown>;
          if (!Number.isNaN(sinceTime)) {
            const ts = Date.parse(String(record.timestamp || ""));
            if (Number.isNaN(ts) || ts < sinceTime) return false;
          }
          if (urlFilter && !String(record.url || "").includes(urlFilter)) return false;
          return true;
        });

        const sample = filtered.slice(-limit);

        if (sample.length === 0) {
          printCommandResult("sse", {
            session: exported.session,
            page: exported.page,
            data: {
              count: 0,
              records: [],
              message:
                "No SSE records. Ensure EventSource is used after session create.",
            },
          });
          return;
        }

        printCommandResult("sse", {
          session: exported.session,
          page: exported.page,
          data: {
            count: sample.length,
            total: filtered.length,
            records: sample,
          },
        });
      } catch (error) {
        printSessionAwareCommandError("sse", error, {
          code: "SSE_FAILED",
          message: "sse failed",
          suggestions: ["Run `pw session create <name> --open <url>` first"],
        });
        process.exitCode = 1;
      }
    },
  );
}
