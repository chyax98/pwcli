import { type Command, Option } from "commander";
import { managedCheck } from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
  withActionFailureScreenshot,
} from "./session-options.js";

type CheckOptions = {
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

function buildSemanticTarget(options: CheckOptions) {
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

export function registerCheckCommand(program: Command): void {
  addSessionOption(
    program
      .command("check [ref]")
      .description("Check a checkbox or radio by ref, selector, or semantic locator")
      .option("--selector <selector>", "Selector target")
      .option("--role <role>", "Role locator")
      .option("--name <name>", "Accessible name for --role")
      .option("--text <text>", "Exact text locator")
      .option("--label <label>", "Exact label locator")
      .option("--placeholder <text>", "Exact placeholder locator")
      .option("--test-id <id>", "Test id locator")
      .addOption(new Option("--testid <id>").hideHelp())
      .option("--nth <number>", "1-based match index", "1"),
  ).action(async (ref: string | undefined, options: CheckOptions) => {
    try {
      const sessionName = requireSessionName(options);
      const nth = parseNth(options.nth);
      options.testid = options.testId || options.testid;
      const semantic = buildSemanticTarget(options);
      printCommandResult(
        "check",
        await withActionFailureScreenshot(sessionName, () => managedCheck({
          ref: options.selector || semantic ? undefined : ref,
          selector: options.selector,
          nth: options.selector ? nth : undefined,
          semantic,
          sessionName,
        }), "check"),
      );
    } catch (error) {
      printSessionAwareCommandError("check", error, {
        code: "CHECK_FAILED",
        message: "check failed",
        suggestions: [
          "Use `pw check --session bug-a e6` for a fresh ref",
          "Use `pw check --session bug-a --selector '#agree'`",
          "Use `pw check --session bug-a --label 'I agree'`",
        ],
      });
      process.exitCode = 1;
    }
  });
}
