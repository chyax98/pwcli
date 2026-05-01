import { type Command, Option } from "commander";
import { managedSelect } from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
  withActionFailureScreenshot,
} from "./session-options.js";

type SelectOptions = {
  session?: string;
  selector?: string;
  role?: string;
  name?: string;
  text?: string;
  label?: string;
  placeholder?: string;
  testId?: string;
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

function buildSemanticTarget(options: SelectOptions) {
  const nth = parseNth(options.nth);
  const testid = options.testId || options.testid;
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
  if (testid) {
    return { kind: "testid" as const, testid, nth };
  }
  return undefined;
}

export function registerSelectCommand(program: Command): void {
  addSessionOption(
    program
      .command("select [targetOrValue] [value]")
      .description("Select an option value by ref, selector, or semantic locator")
      .option("--selector <selector>", "Selector target")
      .option("--role <role>", "Role locator")
      .option("--name <name>", "Accessible name for --role")
      .option("--text <text>", "Text locator")
      .option("--label <label>", "Label locator")
      .option("--placeholder <text>", "Placeholder locator")
      .option("--test-id <id>", "Test id locator")
      .addOption(new Option("--testid <id>").hideHelp())
      .option("--nth <number>", "1-based match index", "1"),
  ).action(async (targetOrValue: string | undefined, value: string | undefined, options: SelectOptions) => {
    try {
      const sessionName = requireSessionName(options);
      const nth = parseNth(options.nth);
      options.testid = options.testId || options.testid;
      const semantic = buildSemanticTarget(options);
      const hasSemantic = Boolean(options.selector || semantic);

      let ref: string | undefined;
      let selectedValue: string | undefined;

      if (hasSemantic) {
        // With semantic/selector: targetOrValue is the value
        selectedValue = targetOrValue;
      } else {
        // With ref: targetOrValue is the ref, value is the value
        ref = targetOrValue;
        selectedValue = value;
      }

      if (!selectedValue) {
        throw new Error("select requires an option value");
      }

      printCommandResult(
        "select",
        await withActionFailureScreenshot(sessionName, () => managedSelect({
          ref: hasSemantic ? undefined : ref,
          selector: options.selector,
          semantic,
          sessionName,
          nth: options.selector ? nth : undefined,
          value: selectedValue!,
        }), "select"),
      );
    } catch (error) {
      printSessionAwareCommandError("select", error, {
        code: "SELECT_FAILED",
        message: "select failed",
        suggestions: [
          "Use `pw select --session bug-a e6 value` for a fresh ref",
          "Use `pw select --session bug-a --selector '#country' value`",
          "Use `pw select --session bug-a --label 'Country' value`",
        ],
      });
      process.exitCode = 1;
    }
  });
}
