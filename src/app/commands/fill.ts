import type { Command } from "commander";
import { managedFill } from "../../domain/interaction/service.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

type FillOptions = {
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

function buildSemanticTarget(options: FillOptions) {
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

export function registerFillCommand(program: Command): void {
  addSessionOption(
    program
      .command("fill [parts...]")
      .description("Fill an input by aria ref, selector, or semantic locator")
      .option("--selector <selector>", "Selector target when no ref is provided")
      .option("--role <role>", "Role locator")
      .option("--name <name>", "Accessible name for --role")
      .option("--text <text>", "Exact text locator")
      .option("--label <label>", "Exact label locator")
      .option("--placeholder <text>", "Exact placeholder locator")
      .option("--testid <id>", "Test id locator")
      .option("--nth <number>", "1-based match index", "1"),
  ).action(async (parts: string[], options: FillOptions) => {
    try {
      const sessionName = requireSessionName(options);
      const values = Array.isArray(parts) ? parts : [];
      const semantic = buildSemanticTarget(options);
      const ref = options.selector || semantic ? undefined : values[0];
      const value = options.selector || semantic ? values.join(" ") : values.slice(1).join(" ");
      if (!value) {
        throw new Error("fill requires a value");
      }
      printCommandResult(
        "fill",
        await managedFill({
          ref,
          selector: options.selector,
          semantic,
          value,
          sessionName,
        }),
      );
    } catch (error) {
      printSessionAwareCommandError("fill", error, {
        code: "FILL_FAILED",
        message: "fill failed",
        suggestions: [
          "Use `pw fill --session bug-a e3 value` for a fresh ref",
          "Use `pw fill --session bug-a --selector 'input[name=email]' value`",
          "Use semantic locators such as `pw fill --session bug-a --label Email user@example.com`",
        ],
      });
      process.exitCode = 1;
    }
  });
}
