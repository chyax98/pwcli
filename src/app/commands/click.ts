import type { Command } from "commander";
import { managedClick, managedRunCode } from "../../domain/interaction/service.js";
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

      const nth = Math.max(1, options.nth ? Number(options.nth) : 1) - 1;
      let source = "";
      if (options.role) {
        source = `async page => { await page.getByRole(${JSON.stringify(options.role)}, ${options.name ? `{ name: ${JSON.stringify(options.name)}, exact: true }` : "undefined"}).nth(${nth}).click(); return 'clicked'; }`;
      } else if (options.text) {
        source = `async page => { await page.getByText(${JSON.stringify(options.text)}, { exact: true }).nth(${nth}).click(); return 'clicked'; }`;
      } else if (options.label) {
        source = `async page => { await page.getByLabel(${JSON.stringify(options.label)}, { exact: true }).nth(${nth}).click(); return 'clicked'; }`;
      } else if (options.placeholder) {
        source = `async page => { await page.getByPlaceholder(${JSON.stringify(options.placeholder)}, { exact: true }).nth(${nth}).click(); return 'clicked'; }`;
      } else if (options.testid) {
        source = `async page => { await page.getByTestId(${JSON.stringify(options.testid)}).nth(${nth}).click(); return 'clicked'; }`;
      } else {
        throw new Error("click requires a ref or one semantic locator");
      }

      printCommandResult(
        "click",
        await managedRunCode({
          sessionName,
          source,
        }),
      );
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
