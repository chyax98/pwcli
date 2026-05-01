import type { Command } from "commander";
import {
  managedStorageIndexedDbExport,
  managedStorageMutation,
  managedStorageRead,
} from "../../domain/identity-state/service.js";
import { printCommandError, printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerStorageCommand(program: Command): void {
  addSessionOption(
    program
      .command("storage <kind> [action] [key] [value]")
      .description("Read or mutate current-page localStorage/sessionStorage, or export IndexedDB")
      .option("--database <name>", "Filter IndexedDB export to one database")
      .option("--store <name>", "Filter IndexedDB export to one object store")
      .option("--limit <n>", "Limit sampled IndexedDB records", "20")
      .option("--include-records", "Include sampled IndexedDB record previews"),
  ).action(
    async (
      kind: string,
      action: string | undefined,
      key: string | undefined,
      value: string | undefined,
      options: {
        session?: string;
        database?: string;
        store?: string;
        limit?: string;
        includeRecords?: boolean;
      },
      command: Command,
    ) => {
      try {
        const sessionName = requireSessionName(options, command);
        if (kind === "indexeddb") {
          if (action !== "export") {
            throw new Error("storage indexeddb requires export");
          }
          const limit = options.limit ? Number(options.limit) : 20;
          if (!Number.isFinite(limit) || limit <= 0) {
            throw new Error("storage indexeddb export requires a positive integer for --limit");
          }
          if (key !== undefined || value !== undefined) {
            throw new Error("storage indexeddb export does not accept positional key/value arguments");
          }
          printCommandResult(
            "storage indexeddb export",
            await managedStorageIndexedDbExport({
              sessionName,
              database: options.database,
              store: options.store,
              limit,
              includeRecords: Boolean(options.includeRecords),
            }),
          );
          return;
        }
        if (kind !== "local" && kind !== "session") {
          throw new Error("storage requires local, session, or indexeddb");
        }
        if (!action) {
          printCommandResult(
            `storage ${kind}`,
            await managedStorageRead(kind, {
              sessionName,
            }),
          );
          return;
        }
        if (action !== "get" && action !== "set" && action !== "delete" && action !== "clear") {
          throw new Error("storage action requires get, set, delete, or clear");
        }
        printCommandResult(
          `storage ${kind} ${action}`,
          await managedStorageMutation(kind, action, {
            key,
            sessionName,
            value,
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === "INDEXEDDB_ORIGIN_UNAVAILABLE") {
          printCommandError("storage indexeddb export", {
            code: "INDEXEDDB_ORIGIN_UNAVAILABLE",
            message: "indexeddb export requires a page with a stable origin",
            suggestions: [
              "Open an http(s) page before exporting IndexedDB",
              "Do not run `pw storage indexeddb export` on about:blank, data:, or file: URLs",
            ],
          });
          process.exitCode = 1;
          return;
        }
        if (message === "INDEXEDDB_UNSUPPORTED") {
          printCommandError("storage indexeddb export", {
            code: "INDEXEDDB_UNSUPPORTED",
            message: "indexeddb export is not available in this browser/page context",
            suggestions: [
              "Use a Chromium-backed session with a live page origin",
              "Retry on a target page after navigation settles",
            ],
          });
          process.exitCode = 1;
          return;
        }
        printSessionAwareCommandError("storage", error, {
          code: "STORAGE_FAILED",
          message: "storage failed",
          suggestions: [
            "Use `pw storage local --session <name>` or `pw storage session --session <name>`",
            "Use `pw storage local set --session <name> <key> <value>` for current-origin mutation",
            "Use `pw storage indexeddb export --session <name>` for current-origin IndexedDB summary",
            "Open a page with a stable origin before reading or mutating storage",
          ],
        });
        process.exitCode = 1;
      }
    },
  );
}
