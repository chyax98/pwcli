import type { Command } from "commander";
import { managedTrace } from "../../domain/diagnostics/service.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerTraceCommand(program: Command): void {
  addSessionOption(
    program
      .command("trace <action>")
      .description("Start or stop tracing in a named managed session"),
  ).action(async (action: string, options: { session?: string }) => {
    try {
      const sessionName = requireSessionName(options);
      if (action !== "start" && action !== "stop") {
        throw new Error("trace requires start or stop");
      }
      printCommandResult("trace", await managedTrace(action, { sessionName }));
    } catch (error) {
      printSessionAwareCommandError("trace", error, {
        code: "TRACE_FAILED",
        message: "trace failed",
        suggestions: ["Use `pw trace --session bug-a start` or `pw trace --session bug-a stop`"],
      });
      process.exitCode = 1;
    }
  });
}
