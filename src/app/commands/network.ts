import type { Command } from "commander";
import { managedNetwork } from "../../domain/diagnostics/service.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerNetworkCommand(program: Command): void {
  addSessionOption(
    program
      .command("network")
      .description("Show recent network activity from a named managed session"),
  ).action(async (options: { session?: string }) => {
    try {
      const sessionName = requireSessionName(options);
      printCommandResult("network", await managedNetwork({ sessionName }));
    } catch (error) {
      printSessionAwareCommandError("network", error, {
        code: "NETWORK_FAILED",
        message: "network failed",
        suggestions: ["Run `pw session create <name> --open <url>` first"],
      });
      process.exitCode = 1;
    }
  });
}
