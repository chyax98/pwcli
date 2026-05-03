import type { Command } from "commander";
import {
  managedHarReplay,
  managedHarReplayStop,
} from "../../infra/playwright/runtime.js";
import { printCommandError, printCommandResult } from "../output.js";
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
      .description("Start HAR recording (not supported on managed sessions — use har replay)"),
  ).action(async (_path: string | undefined, _options: { session?: string }) => {
    printCommandError("har start", {
      code: "UNSUPPORTED_HAR_CAPTURE",
      message: "HAR recording is not supported on managed sessions. The Playwright BrowserContext is already open and HAR capture must be configured at context creation time.",
      suggestions: [
        "Use `pw har replay <file>` to replay a pre-recorded HAR for deterministic network stubbing",
        "To capture a real HAR, use browser DevTools Network panel or Playwright's recordHar option at session creation",
      ],
    });
    process.exitCode = 1;
  });

  addSessionOption(
    har
      .command("stop")
      .description("Stop HAR recording (not supported on managed sessions — use har replay)"),
  ).action(async (_options: { session?: string }) => {
    printCommandError("har stop", {
      code: "UNSUPPORTED_HAR_CAPTURE",
      message: "HAR recording is not supported on managed sessions.",
      suggestions: [
        "Use `pw har replay stop --session <name>` to stop an active HAR replay",
      ],
    });
    process.exitCode = 1;
  });

  const replay = har
    .command("replay <file>")
    .description("Replay network traffic from a HAR file");

  addSessionOption(replay).action(
    async (file: string, options: { session?: string }, command: Command) => {
      try {
        const sessionName = requireSessionName(options, command);
        printCommandResult(
          "har replay",
          await managedHarReplay({
            sessionName,
            filePath: file,
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
