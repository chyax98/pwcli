import type { Command } from "commander";
import { managedVideoStart, managedVideoStop } from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerVideoCommand(program: Command): void {
  const video = program.command("video").description("Video recording controls");

  addSessionOption(video.command("start").description("Start video recording")).action(
    async (options: { session?: string }) => {
      try {
        const sessionName = requireSessionName(options);
        const result = await managedVideoStart({ sessionName });
        printCommandResult("video start", result);
      } catch (error) {
        printSessionAwareCommandError("video start", error, {
          code: "VIDEO_START_FAILED",
          message: "video start failed",
          suggestions: ["Use `pw video start --session <name>`"],
        });
        process.exitCode = 1;
      }
    },
  );

  addSessionOption(video.command("stop").description("Stop video recording")).action(
    async (options: { session?: string }) => {
      try {
        const sessionName = requireSessionName(options);
        const result = await managedVideoStop({ sessionName });
        printCommandResult("video stop", result);
      } catch (error) {
        printSessionAwareCommandError("video stop", error, {
          code: "VIDEO_STOP_FAILED",
          message: "video stop failed",
          suggestions: ["Use `pw video stop --session <name>`"],
        });
        process.exitCode = 1;
      }
    },
  );
}
