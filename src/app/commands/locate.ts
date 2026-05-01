import { type Command, Option } from "commander";
import { managedLocate } from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";
import { parseStateTarget, type StateTargetOptions } from "./state-target.js";

export function registerLocateCommand(program: Command): void {
  addSessionOption(
    program
      .command("locate")
      .description("Locate elements by selector, text, role/name, label, placeholder, or test id")
      .option("--selector <selector>", "CSS selector")
      .option("--text <text>", "Exact text locator")
      .option("--role <role>", "Role locator")
      .option("--name <name>", "Accessible name for --role")
      .option("--label <label>", "Exact label locator")
      .option("--placeholder <text>", "Exact placeholder locator")
      .option("--test-id <id>", "Test id locator")
      .addOption(new Option("--testid <id>").hideHelp())
      .option("--nth <number>", "1-based match index", "1"),
  ).action(async (options: StateTargetOptions & { session?: string }) => {
    try {
      const sessionName = requireSessionName(options);
      printCommandResult(
        "locate",
        await managedLocate({
          sessionName,
          target: parseStateTarget(options),
        }),
      );
    } catch (error) {
      printSessionAwareCommandError("locate", error, {
        code: "LOCATE_FAILED",
        message: "locate failed",
        suggestions: [
          "Pass exactly one target: --selector, --text, --role, --label, --placeholder, or --test-id",
        ],
      });
      process.exitCode = 1;
    }
  });
}
