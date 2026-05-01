import type { Command } from "commander";
import { managedType } from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
  withActionFailureScreenshot,
} from "./session-options.js";

type TypeOptions = {
  session?: string;
  selector?: string;
  role?: string;
  name?: string;
  text?: string;
  label?: string;
  placeholder?: string;
  testid?: string;
  nth?: string;
};

function parseNth(value?: string) {
  const nth = Number(value ?? "1");
  if (!Number.isInteger(nth) || nth < 1) {
    throw new Error("--nth requires a positive integer");
  }
  return nth;
}

function buildSemanticTarget(options: TypeOptions) {
  const nth = parseNth(options.nth);
  if (options.role) {
    return {
      kind: "role" as const,
      role: options.role,
      ...(options.name ? { name: options.name } : {}),
      nth,
    };
  }
  if (options.text) {
    return { kind: "text" as const, text: options.text, nth };
  }
  if (options.label) {
    return { kind: "label" as const, label: options.label, nth };
  }
  if (options.placeholder) {
    return { kind: "placeholder" as const, placeholder: options.placeholder, nth };
  }
  if (options.testid) {
    return { kind: "testid" as const, testid: options.testid, nth };
  }
  return undefined;
}

export function registerTypeCommand(program: Command): void {
  addSessionOption(
    program
      .command("type [parts...]")
      .description("Type text into the focused element, aria ref, selector, or semantic locator")
      .option("--selector <selector>", "Selector target when no ref is provided")
      .option("--role <role>", "Role locator")
      .option("--name <name>", "Accessible name for --role")
      .option("--text <text>", "Exact text locator")
      .option("--label <label>", "Exact label locator")
      .option("--placeholder <text>", "Exact placeholder locator")
      .option("--testid <id>", "Test id locator")
      .option("--nth <number>", "1-based match index", "1"),
  ).action(async (parts: string[], options: TypeOptions) => {
    try {
      const sessionName = requireSessionName(options);
      const values = Array.isArray(parts) ? parts : [];
      const nth = parseNth(options.nth);
      const semantic = buildSemanticTarget(options);
      const ref =
        options.selector || semantic ? undefined : values.length > 1 ? values[0] : undefined;
      const value =
        options.selector || semantic
          ? values.join(" ")
          : values.length > 1
            ? values.slice(1).join(" ")
            : values[0];
      if (!value) {
        throw new Error("type requires a value");
      }
      printCommandResult(
        "type",
        await withActionFailureScreenshot(sessionName, () => managedType({
          ref,
          selector: options.selector,
          nth: options.selector ? nth : undefined,
          semantic,
          value,
          sessionName,
        })),
      );
    } catch (error) {
      printSessionAwareCommandError("type", error, {
        code: "TYPE_FAILED",
        message: "type failed",
        suggestions: [
          "Use `pw type --session bug-a value` for the focused element",
          "Use `pw type --session bug-a e3 value` for a fresh ref",
          "Use semantic locators such as `pw type --session bug-a --role textbox --name Comment hello`",
        ],
      });
      process.exitCode = 1;
    }
  });
}
