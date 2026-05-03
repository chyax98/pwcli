import { type Command, Option } from "commander";
import { managedIsState } from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";
import { parseStateTarget, type StateTargetOptions } from "./state-target.js";

const states = new Set(["visible", "enabled", "checked"]);

export function registerIsCommand(program: Command): void {
  addSessionOption(
    program
      .command("is <state>")
      .description("Check a boolean target state: visible, enabled, or checked")
      .option("--selector <selector>", "CSS selector")
      .option("--text <text>", "Exact text locator")
      .option("--role <role>", "Role locator")
      .option("--name <name>", "Accessible name for --role")
      .option("--label <label>", "Exact label locator")
      .option("--placeholder <text>", "Exact placeholder locator")
      .option("--test-id <id>", "Test id locator")
      .addOption(new Option("--testid <id>").hideHelp())
      .option("--nth <number>", "1-based match index"),
  ).action(async (state: string, options: StateTargetOptions & { session?: string }) => {
    try {
      const sessionName = requireSessionName(options);
      if (!states.has(state)) {
        throw new Error("is state must be one of: visible, enabled, checked");
      }
      printCommandResult(
        "is",
        await managedIsState({
          sessionName,
          state: state as "visible" | "enabled" | "checked",
          target: parseStateTarget(options),
        }),
      );
    } catch (error) {
      printSessionAwareCommandError("is", error, {
        code: "IS_FAILED",
        message: "is failed",
        suggestions: [
          "Use `pw is visible --session bug-a --selector '#submit'`",
          "Use `pw is enabled --session bug-a --role button --name Submit`",
          "Use `pw is checked --session bug-a --selector '#agree'` for checkbox/radio controls",
        ],
      });
      process.exitCode = 1;
    }
  });
}
