import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Command } from "commander";
import { readRunEvents } from "../../infra/fs/run-artifacts.js";
import { managedDiagnosticsExport } from "../../infra/playwright/runtime.js";
import {
  applyDiagnosticsExportFilter,
  buildRunDigest,
  buildSessionDigest,
  listDiagnosticsRuns,
  managedDiagnosticsBundle,
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
      .option("--limit <n>", "Limit array-like sections to the last N items")
      .option("--since <iso>", "Keep only records at or after the given ISO timestamp")
      .option("--text <substring>", "Keep only array records whose JSON includes the substring")
      .option(
        "--fields <list>",
        "Comma-separated projection list; use path or alias=path for record-array projection",
      ),
  ).action(
    async (
      options: {
        session?: string;
        out?: string;
        section?: string;
        limit?: string;
        since?: string;
        text?: string;
        fields?: string;
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
        const useFilteredExport = Boolean(
          section || limit || options.since || options.text || options.fields,
        );
        const exported = await managedDiagnosticsExport({ sessionName });
        const result = useFilteredExport
          ? applyDiagnosticsExportFilter(exported, {
              section,
              limit,
              since: options.since,
              text: options.text,
              fields: options.fields,
            })
          : exported;
        await writeFile(out, JSON.stringify(result.data, null, 2), "utf8");
        printCommandResult("diagnostics export", {
          session: result.session as Record<string, unknown>,
          page: result.page as Record<string, unknown>,
          data: {
            exported: true,
            out,
            ...(section ? { section } : {}),
            ...(limit ? { limit } : {}),
            ...(options.since ? { since: options.since } : {}),
            ...(options.text ? { text: options.text } : {}),
            ...(options.fields ? { fields: options.fields } : {}),
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

  addSessionOption(
    diagnostics
      .command("bundle")
      .description("Export a compact failure bundle for one session")
      .requiredOption("--out <dir>", "Output directory")
      .option("--limit <n>", "Limit records per section", "20"),
  ).action(
    async (
      options: {
        session?: string;
        out?: string;
        limit?: string;
      },
      command: Command,
    ) => {
      try {
        const sessionName = requireSessionName(options, command);
        const out = options.out?.trim();
        if (!out) {
          throw new Error("diagnostics bundle requires --out <dir>");
        }
        const limit = options.limit ? Number(options.limit) : 20;
        if (!Number.isFinite(limit) || limit <= 0) {
          throw new Error("diagnostics bundle requires a positive integer for --limit");
        }
        const exported = await managedDiagnosticsExport({ sessionName });
        const result = await managedDiagnosticsBundle({ sessionName, limit, exported });
        const bundleDir = resolve(out);
        await mkdir(bundleDir, { recursive: true });
        await writeFile(
          resolve(bundleDir, "manifest.json"),
          JSON.stringify(result.data, null, 2),
          "utf8",
        );
        printCommandResult("diagnostics bundle", {
          session: result.session as Record<string, unknown>,
          page: result.page as Record<string, unknown>,
          data: {
            bundled: true,
            out: bundleDir,
            limit,
            latestRunId: (result.data as Record<string, unknown>).latestRunId,
            auditConclusion: (result.data as Record<string, unknown>).auditConclusion,
          },
        });
      } catch (error) {
        printSessionAwareCommandError("diagnostics bundle", error, {
          code: "DIAGNOSTICS_BUNDLE_FAILED",
          message: "diagnostics bundle failed",
          suggestions: [
            "Run `pw diagnostics bundle --session <name> --out <dir>`",
            "Create or attach a session first with `pw session create|attach`",
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
    .option("--session <name>", "Keep only runs recorded under the given session name")
    .option("--since <iso>", "Keep only runs whose last activity is at or after the ISO timestamp")
    .action(async (options: { limit?: string; session?: string; since?: string }) => {
      try {
        const limit = options.limit ? Number(options.limit) : undefined;
        if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
          throw new Error("diagnostics runs requires a positive integer for --limit");
        }
        const runs = await listDiagnosticsRuns({
          limit,
          sessionName: options.session,
          since: options.since,
        });
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
          ? { data: { source: "run", ...buildRunDigest(runId, await readRunEvents(runId), limit) } }
          : await (async () => {
              const sn = requireSessionName(options, command);
              const exported = await managedDiagnosticsExport({ sessionName: sn });
              const digest = buildSessionDigest(exported, limit);
              return {
                session: digest.session as Record<string, unknown> | undefined,
                page: digest.page as Record<string, unknown> | undefined,
                data: digest.data as Record<string, unknown>,
              };
            })();
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
    .option("--since <iso>", "Keep only events at or after the given ISO timestamp")
    .option(
      "--fields <list>",
      "Comma-separated projection list; use path or alias=path for event projection",
    )
    .action(
      async (options: {
        run?: string;
        command?: string;
        limit?: string;
        since?: string;
        fields?: string;
      }) => {
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
            since: options.since,
            fields: options.fields,
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
      },
    );

  diagnostics
    .command("grep")
    .description("Filter run events by substring")
    .requiredOption("--run <runId>", "Run id")
    .requiredOption("--text <substring>", "Substring to match")
    .option("--command <name>", "Filter run events by command name")
    .option("--limit <n>", "Limit returned events")
    .option("--since <iso>", "Keep only events at or after the given ISO timestamp")
    .option(
      "--fields <list>",
      "Comma-separated projection list; use path or alias=path for event projection",
    )
    .action(
      async (options: {
        run?: string;
        text?: string;
        command?: string;
        limit?: string;
        since?: string;
        fields?: string;
      }) => {
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
            since: options.since,
            fields: options.fields,
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
      },
    );
}
