import { writeFile } from "node:fs/promises";
import type { Command } from "commander";
import {
  listDiagnosticsRuns,
  managedDiagnosticsDigest,
  managedDiagnosticsExport,
  managedDiagnosticsExportFiltered,
  readDiagnosticsRunView,
} from "../../domain/diagnostics/service.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerDiagnosticsCommand(program: Command): void {
  const diagnostics = program
    .command("diagnostics")
    .description("Query and export diagnostics and run events");

  addSessionOption(
    diagnostics
      .command("export")
      .description("Export current session diagnostics to a JSON file")
      .requiredOption("--out <file>", "Output file")
      .option(
        "--section <section>",
        "Export one section: all|workspace|console|network|errors|routes|bootstrap",
      )
      .option("--limit <n>", "Limit array-like sections to the last N items"),
  ).action(
    async (
      options: {
        session?: string;
        out?: string;
        section?: string;
        limit?: string;
      },
      command: Command,
    ) => {
      try {
        const sessionName = requireSessionName(options, command);
        const out = options.out;
        if (!out) {
          throw new Error("diagnostics export requires --out <file>");
        }
        const section = options.section?.trim() as
          | "all"
          | "workspace"
          | "console"
          | "network"
          | "errors"
          | "routes"
          | "bootstrap"
          | undefined;
        const limit = options.limit ? Number(options.limit) : undefined;
        if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
          throw new Error("diagnostics export requires a positive integer for --limit");
        }
        const result =
          section || limit
            ? await managedDiagnosticsExportFiltered({
                sessionName,
                section,
                limit,
              })
            : await managedDiagnosticsExport({ sessionName });
        await writeFile(out, JSON.stringify(result.data, null, 2), "utf8");
        printCommandResult("diagnostics export", {
          session: result.session,
          page: result.page,
          data: {
            exported: true,
            out,
            ...(section ? { section } : {}),
            ...(limit ? { limit } : {}),
          },
        });
      } catch (error) {
        printSessionAwareCommandError("diagnostics export", error, {
          code: "DIAGNOSTICS_EXPORT_FAILED",
          message: "diagnostics export failed",
          suggestions: [
            "Run `pw session create <name> --open <url>` first",
            "Pass `--out <file>` to save exported diagnostics",
          ],
        });
        process.exitCode = 1;
      }
    },
  );

  diagnostics
    .command("runs")
    .description("List known run ids")
    .option("--limit <n>", "Limit returned runs")
    .action(async (options: { limit?: string }) => {
      try {
        const limit = options.limit ? Number(options.limit) : undefined;
        if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
          throw new Error("diagnostics runs requires a positive integer for --limit");
        }
        const runs = await listDiagnosticsRuns({ limit });
        printCommandResult("diagnostics runs", {
          data: {
            count: runs.length,
            runs,
          },
        });
      } catch (error) {
        printSessionAwareCommandError("diagnostics runs", error, {
          code: "DIAGNOSTICS_RUNS_FAILED",
          message: "diagnostics runs failed",
        });
        process.exitCode = 1;
      }
    });

  addSessionOption(
    diagnostics
      .command("digest")
      .description("Summarize current session diagnostics or one recorded run")
      .option("--run <runId>", "Summarize one recorded run")
      .option("--limit <n>", "Limit top signals and recent samples", "5"),
  ).action(
    async (
      options: {
        session?: string;
        run?: string;
        limit?: string;
      },
      command: Command,
    ) => {
      try {
        const runId = options.run?.trim();
        const sessionName =
          command.optsWithGlobals<{ session?: string }>().session?.trim() ||
          options.session?.trim();
        if (runId && sessionName) {
          throw new Error(
            "diagnostics digest accepts either --run <runId> or --session <name>, not both",
          );
        }
        if (!runId && !sessionName) {
          throw new Error("diagnostics digest requires --run <runId> or --session <name>");
        }
        const limit = options.limit ? Number(options.limit) : 5;
        if (!Number.isFinite(limit) || limit <= 0) {
          throw new Error("diagnostics digest requires a positive integer for --limit");
        }
        const result = runId
          ? await managedDiagnosticsDigest({ runId, limit })
          : await managedDiagnosticsDigest({
              sessionName: requireSessionName(options, command),
              limit,
            });
        printCommandResult("diagnostics digest", result);
      } catch (error) {
        printSessionAwareCommandError("diagnostics digest", error, {
          code: "DIAGNOSTICS_DIGEST_FAILED",
          message: "diagnostics digest failed",
          suggestions: [
            "Use `pw diagnostics digest --session <name>` for a live session summary",
            "Or use `pw diagnostics digest --run <runId>` after `pw diagnostics runs`",
          ],
        });
        process.exitCode = 1;
      }
    },
  );

  diagnostics
    .command("show")
    .description("Show all events for one run")
    .requiredOption("--run <runId>", "Run id")
    .option("--command <name>", "Filter run events by command name")
    .option("--limit <n>", "Limit returned events")
    .action(async (options: { run?: string; command?: string; limit?: string }) => {
      try {
        const runId = options.run;
        if (!runId) {
          throw new Error("diagnostics show requires --run <runId>");
        }
        const limit = options.limit ? Number(options.limit) : undefined;
        if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
          throw new Error("diagnostics show requires a positive integer for --limit");
        }
        const data = await readDiagnosticsRunView({
          runId,
          command: options.command,
          limit,
        });
        printCommandResult("diagnostics show", {
          data,
        });
      } catch (error) {
        printSessionAwareCommandError("diagnostics show", error, {
          code: "DIAGNOSTICS_SHOW_FAILED",
          message: "diagnostics show failed",
          suggestions: ["Use `pw diagnostics runs` to list available run ids"],
        });
        process.exitCode = 1;
      }
    });

  diagnostics
    .command("grep")
    .description("Filter run events by substring")
    .requiredOption("--run <runId>", "Run id")
    .requiredOption("--text <substring>", "Substring to match")
    .option("--command <name>", "Filter run events by command name")
    .option("--limit <n>", "Limit returned events")
    .action(async (options: { run?: string; text?: string; command?: string; limit?: string }) => {
      try {
        const runId = options.run;
        const text = options.text;
        if (!runId || !text) {
          throw new Error("diagnostics grep requires --run <runId> and --text <substring>");
        }
        const limit = options.limit ? Number(options.limit) : undefined;
        if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
          throw new Error("diagnostics grep requires a positive integer for --limit");
        }
        const data = await readDiagnosticsRunView({
          runId,
          text,
          command: options.command,
          limit,
        });
        printCommandResult("diagnostics grep", {
          data,
        });
      } catch (error) {
        printSessionAwareCommandError("diagnostics grep", error, {
          code: "DIAGNOSTICS_GREP_FAILED",
          message: "diagnostics grep failed",
          suggestions: ["Use `pw diagnostics runs` to list available run ids"],
        });
        process.exitCode = 1;
      }
    });
}
