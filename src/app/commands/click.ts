import type { Command } from "commander";
import { managedClick } from "../../domain/interaction/service.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerClickCommand(program: Command): void {
  addSessionOption(
    program
      .command("click [ref]")
      .description("Click by aria ref, selector, or semantic locator")
      .option("--selector <selector>", "CSS selector")
      .option("--role <role>", "Role locator")
      .option("--name <name>", "Accessible name for --role")
      .option("--text <text>", "Exact text locator")
      .option("--label <label>", "Exact label locator")
      .option("--placeholder <text>", "Exact placeholder locator")
      .option("--testid <id>", "Test id locator")
      .option("--nth <number>", "1-based match index", "1"),
  ).action(async (ref: string | undefined, options: Record<string, string>) => {
    try {
      const sessionName = requireSessionName(options);
      if (ref || options.selector) {
        printCommandResult(
          "click",
          await managedClick({
            ref,
            selector: options.selector,
            sessionName,
          }),
        );
        return;
      }

      const nth = Math.max(1, options.nth ? Number(options.nth) : 1);
      if (options.role) {
        printCommandResult(
          "click",
          await managedClick({
            semantic: {
              kind: "role",
              role: options.role,
              ...(options.name ? { name: options.name } : {}),
              nth,
            },
            sessionName,
          }),
        );
      } else if (options.text) {
        printCommandResult(
          "click",
          await managedClick({
            semantic: { kind: "text", text: options.text, nth },
            sessionName,
          }),
        );
      } else if (options.label) {
        printCommandResult(
          "click",
          await managedClick({
            semantic: { kind: "label", label: options.label, nth },
            sessionName,
          }),
        );
      } else if (options.placeholder) {
        printCommandResult(
          "click",
          await managedClick({
            semantic: { kind: "placeholder", placeholder: options.placeholder, nth },
            sessionName,
          }),
        );
      } else if (options.testid) {
        printCommandResult(
          "click",
          await managedClick({
            semantic: { kind: "testid", testid: options.testid, nth },
            sessionName,
          }),
        );
      } else {
        throw new Error("click requires a ref or one semantic locator");
      }
    } catch (error) {
      printSessionAwareCommandError("click", error, {
        code: "CLICK_FAILED",
        message: "click failed",
        suggestions: [
          "Pass a valid aria ref from `pw snapshot`",
          "Or use one semantic locator: --selector/--role/--text/--label/--placeholder/--testid",
        ],
      });
      process.exitCode = 1;
    }
  });
}
