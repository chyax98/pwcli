import type { Command } from "commander";
import { managedHar } from "../../domain/diagnostics/service.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerHarCommand(program: Command): void {
  addSessionOption(
    program
      .command("har <action> [path]")
      .description("Inspect HAR recording availability for a named managed session"),
  ).action(async (action: string, path: string | undefined, options: { session?: string }) => {
    try {
      const sessionName = requireSessionName(options);
      if (action !== "start" && action !== "stop") {
        throw new Error("har requires start or stop");
      }
      printCommandResult("har", await managedHar(action, { sessionName, path }));
    } catch (error) {
      printSessionAwareCommandError("har", error, {
        code: "HAR_FAILED",
        message: "har failed",
        suggestions: [
          "Use `pw har --session bug-a start ./capture.har` to inspect current HAR limitations",
          "Use `pw har --session bug-a stop` to inspect stop semantics on the current substrate",
        ],
      });
      process.exitCode = 1;
    }
  });
}
