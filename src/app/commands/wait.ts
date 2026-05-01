import type { Command } from "commander";
import { managedWait } from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
  withActionFailureScreenshot,
} from "./session-options.js";

export function registerWaitCommand(program: Command): void {
  addSessionOption(
    program
      .command("wait [target]")
      .description("Wait for a ref, text, selector, networkidle, request, response, or delay")
      .option("--text <text>", "Wait for exact text to appear")
      .option("--selector <selector>", "Wait for selector")
      .option("--networkidle", "Wait until the page reaches networkidle")
      .option("--request <url>", "Wait for a matching request")
      .option("--response <url>", "Wait for a matching response")
      .option("--method <method>", "Restrict request/response by method")
      .option("--status <code>", "Restrict response by status"),
  ).action(async (target: string | undefined, options: Record<string, string | boolean>) => {
    const sessionName = requireSessionName(options as { session?: string });
    try {
      printCommandResult(
        "wait",
        await withActionFailureScreenshot(sessionName, () => managedWait({
          sessionName,
          target: isNetworkIdleTarget(target) ? undefined : target,
          text: typeof options.text === "string" ? options.text : undefined,
          selector: typeof options.selector === "string" ? options.selector : undefined,
          request: typeof options.request === "string" ? options.request : undefined,
          response: typeof options.response === "string" ? options.response : undefined,
          method: typeof options.method === "string" ? options.method : undefined,
          status: typeof options.status === "string" ? options.status : undefined,
          networkidle: Boolean(options.networkidle) || isNetworkIdleTarget(target),
        })),
      );
    } catch (error) {
      printSessionAwareCommandError("wait", error, {
        code: "WAIT_FAILED",
        message: "wait failed",
        suggestions: [
          "Pass exactly one condition",
          "Use `pw wait --session bug-a 2000`, `pw wait --session bug-a e6`, or selector mode",
        ],
      });
      process.exitCode = 1;
    }
  });
}

function isNetworkIdleTarget(target: string | undefined) {
  return target === "networkidle";
}
