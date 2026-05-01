import type { Command } from "commander";
import { managedClick } from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
  withActionFailureScreenshot,
} from "./session-options.js";

function parseNth(value?: string) {
  const nth = Number(value ?? "1");
  if (!Number.isInteger(nth) || nth < 1) {
    throw new Error("--nth requires a positive integer");
  }
  return nth;
}

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
      const nth = parseNth(options.nth);
      const result = await withActionFailureScreenshot(sessionName, () => {
        if (ref || options.selector) {
          return managedClick({
            ref,
            selector: options.selector,
            nth: options.selector ? nth : undefined,
            sessionName,
          });
        }
        if (options.role) {
          return managedClick({
            semantic: {
              kind: "role",
              role: options.role,
              ...(options.name ? { name: options.name } : {}),
              nth,
            },
            sessionName,
          });
        }
        if (options.text) {
          return managedClick({
            semantic: { kind: "text", text: options.text, nth },
            sessionName,
          });
        }
        if (options.label) {
          return managedClick({
            semantic: { kind: "label", label: options.label, nth },
            sessionName,
          });
        }
        if (options.placeholder) {
          return managedClick({
            semantic: { kind: "placeholder", placeholder: options.placeholder, nth },
            sessionName,
          });
        }
        if (options.testid) {
          return managedClick({
            semantic: { kind: "testid", testid: options.testid, nth },
            sessionName,
          });
        }
        throw new Error("click requires a ref or one semantic locator");
      });
      printCommandResult("click", result);
    } catch (error) {
      printSessionAwareCommandError("click", error, {
        code: "CLICK_FAILED",
        message: "click failed",
        suggestions: [
          "Pass a valid aria ref from `pw snapshot`",
          "If the page changed, refresh refs with `pw snapshot -i --session <name>`",
          "Or use one semantic locator: --selector/--role/--text/--label/--placeholder/--testid",
        ],
      });
      process.exitCode = 1;
    }
  });
}
