import { writeFile } from "node:fs/promises";
import type { Command } from "commander";
import { managedDiagnosticsExport } from "../../domain/diagnostics/service.js";
import { listRunDirs, readRunEvents } from "../../infra/fs/run-artifacts.js";
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
      .requiredOption("--out <file>", "Output file"),
  ).action(async (options: { session?: string; out?: string }, command: Command) => {
    try {
      const sessionName = requireSessionName(options, command);
      const out = options.out;
      if (!out) {
        throw new Error("diagnostics export requires --out <file>");
      }
      const result = await managedDiagnosticsExport({ sessionName });
      await writeFile(out, JSON.stringify(result.data, null, 2), "utf8");
      printCommandResult("diagnostics export", {
        session: result.session,
        page: result.page,
        data: {
          exported: true,
          out,
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
  });

  diagnostics
    .command("runs")
    .description("List known run ids")
    .action(async () => {
      try {
        const runs = await listRunDirs();
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

  diagnostics
    .command("show")
    .description("Show all events for one run")
    .requiredOption("--run <runId>", "Run id")
    .action(async (options: { run?: string }) => {
      try {
        const runId = options.run;
        if (!runId) {
          throw new Error("diagnostics show requires --run <runId>");
        }
        const events = await readRunEvents(runId);
        printCommandResult("diagnostics show", {
          data: {
            runId,
            count: events.length,
            events,
          },
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
    .action(async (options: { run?: string; text?: string }) => {
      try {
        const runId = options.run;
        const text = options.text;
        if (!runId || !text) {
          throw new Error("diagnostics grep requires --run <runId> and --text <substring>");
        }
        const events = await readRunEvents(runId);
        const matches = events.filter((event) => JSON.stringify(event).includes(text));
        printCommandResult("diagnostics grep", {
          data: {
            runId,
            text,
            count: matches.length,
            events: matches,
          },
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
