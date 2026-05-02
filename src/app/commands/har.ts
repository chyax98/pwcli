import type { Command } from "commander";
import {
  managedHar,
  managedHarReplay,
  managedHarReplayStop,
} from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerHarCommand(program: Command): void {
  const har = program
    .command("har")
    .description("HAR recording and replay for a named managed session");

  addSessionOption(
    har
      .command("start [path]")
      .description("Start HAR recording"),
  ).action(async (path: string | undefined, options: { session?: string }, command: Command) => {
    try {
      const sessionName = requireSessionName(options, command);
      printCommandResult("har start", await managedHar("start", { sessionName, path }));
    } catch (error) {
      printSessionAwareCommandError("har start", error, {
        code: "HAR_FAILED",
        message: "har start failed",
        suggestions: [
          "Use `pw har start --session bug-a ./capture.har` to inspect current HAR limitations",
        ],
      });
      process.exitCode = 1;
    }
  });

  addSessionOption(
    har
      .command("stop")
      .description("Stop HAR recording"),
  ).action(async (options: { session?: string }, command: Command) => {
    try {
      const sessionName = requireSessionName(options, command);
      printCommandResult("har stop", await managedHar("stop", { sessionName }));
    } catch (error) {
      printSessionAwareCommandError("har stop", error, {
        code: "HAR_FAILED",
        message: "har stop failed",
        suggestions: [
          "Use `pw har stop --session bug-a` to inspect stop semantics on the current substrate",
        ],
      });
      process.exitCode = 1;
    }
  });

  const replay = har
    .command("replay <file>")
    .description("Replay network traffic from a HAR file")
    .option("--update", "Allow updating the HAR file with new requests");

  addSessionOption(replay).action(
    async (file: string, options: { session?: string; update?: boolean }, command: Command) => {
      try {
        const sessionName = requireSessionName(options, command);
        printCommandResult(
          "har replay",
          await managedHarReplay({
            sessionName,
            filePath: file,
            update: options.update,
          }),
        );
      } catch (error) {
        printSessionAwareCommandError("har replay", error, {
          code: "HAR_REPLAY_FAILED",
          message: "har replay failed",
          suggestions: [
            "Run `pw session create <name> --open <url>` first",
            "Ensure the HAR file exists and is valid",
          ],
        });
        process.exitCode = 1;
      }
    },
  );

  addSessionOption(
    replay
      .command("stop")
      .description("Stop HAR replay routing"),
  ).action(async (options: { session?: string }, command: Command) => {
    try {
      const sessionName = requireSessionName(options, command);
      printCommandResult("har replay stop", await managedHarReplayStop({ sessionName }));
    } catch (error) {
      printSessionAwareCommandError("har replay stop", error, {
        code: "HAR_REPLAY_STOP_FAILED",
        message: "har replay stop failed",
        suggestions: ["Run `pw session create <name> --open <url>` first"],
      });
      process.exitCode = 1;
    }
  });
}
