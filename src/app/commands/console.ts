import type { Command } from "commander";
import { managedConsole } from "../../domain/diagnostics/service.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerConsoleCommand(program: Command): void {
  addSessionOption(
    program
      .command("console")
      .description("Show recent console messages from a named managed session")
      .option("--level <level>", "Minimum level: info|warning|error", "info")
      .option("--source <source>", "Filter by source: app|api|react|browser")
      .option("--text <text>", "Filter console messages by substring")
      .option("--since <iso>", "Keep only records at or after the given ISO timestamp")
      .option("--limit <n>", "Limit result sample size"),
  ).action(
    async (options: {
      session?: string;
      level?: string;
      source?: string;
      text?: string;
      since?: string;
      limit?: string;
    }) => {
      try {
        const sessionName = requireSessionName(options);
        printCommandResult(
          "console",
          await managedConsole(options.level, {
            sessionName,
            source: options.source,
            text: options.text,
            since: options.since,
            limit: options.limit ? Number(options.limit) : undefined,
          }),
        );
      } catch (error) {
        printSessionAwareCommandError("console", error, {
          code: "CONSOLE_FAILED",
          message: "console failed",
          suggestions: ["Run `pw session create <name> --open <url>` first"],
        });
        process.exitCode = 1;
      }
    },
  );
}
