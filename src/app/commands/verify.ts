import type { Command } from "commander";
import {
  managedVerify,
  type VerifyAssertion,
  type VerifyOptions,
} from "../../domain/interaction/service.js";
import { printCommandError, printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";
import { parseStateTarget, type StateTargetOptions } from "./state-target.js";

const assertions = new Set<VerifyAssertion>([
  "text",
  "text-absent",
  "url",
  "visible",
  "hidden",
  "enabled",
  "disabled",
  "checked",
  "unchecked",
  "count",
]);

type VerifyCommandOptions = StateTargetOptions & {
  session?: string;
  contains?: string;
  equals?: string;
  matches?: string;
  min?: string;
  max?: string;
};

function parseNumberOption(name: string, value?: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} requires a finite number`);
  }
  return parsed;
}

function parseVerifyOptions(
  assertion: VerifyAssertion,
  sessionName: string,
  options: VerifyCommandOptions,
): VerifyOptions {
  if (assertion === "url") {
    const urlTargets = [options.contains, options.equals, options.matches].filter(Boolean);
    if (urlTargets.length !== 1) {
      throw new Error("verify url requires exactly one of --contains, --equals, or --matches");
    }
    return {
      sessionName,
      assertion,
      url: {
        ...(options.contains ? { contains: options.contains } : {}),
        ...(options.equals ? { equals: options.equals } : {}),
        ...(options.matches ? { matches: options.matches } : {}),
      },
    };
  }

  if (assertion === "count") {
    const equals = parseNumberOption("--equals", options.equals);
    const min = parseNumberOption("--min", options.min);
    const max = parseNumberOption("--max", options.max);
    if (equals === undefined && min === undefined && max === undefined) {
      throw new Error("verify count requires --equals, --min, or --max");
    }
    return {
      sessionName,
      assertion,
      target: parseStateTarget(options),
      count: {
        ...(equals !== undefined ? { equals } : {}),
        ...(min !== undefined ? { min } : {}),
        ...(max !== undefined ? { max } : {}),
      },
    };
  }

  return {
    sessionName,
    assertion,
    target: parseStateTarget(options),
  };
}

export function registerVerifyCommand(program: Command): void {
  addSessionOption(
    program
      .command("verify <assertion>")
      .description("Run a deterministic read-only assertion against page state")
      .option("--selector <selector>", "CSS selector")
      .option("--text <text>", "Exact text locator")
      .option("--role <role>", "Role locator")
      .option("--name <name>", "Accessible name for --role")
      .option("--label <label>", "Exact label locator")
      .option("--placeholder <text>", "Exact placeholder locator")
      .option("--testid <id>", "Test id locator")
      .option("--nth <number>", "1-based match index")
      .option("--contains <text>", "URL substring expectation for verify url")
      .option("--equals <value>", "Exact expectation for verify url or count")
      .option("--matches <regex>", "Regular expression expectation for verify url")
      .option("--min <number>", "Minimum count expectation")
      .option("--max <number>", "Maximum count expectation"),
  ).action(async (rawAssertion: string, options: VerifyCommandOptions) => {
    try {
      if (!assertions.has(rawAssertion as VerifyAssertion)) {
        throw new Error(
          "verify assertion must be one of: text, text-absent, url, visible, hidden, enabled, disabled, checked, unchecked, count",
        );
      }
      const assertion = rawAssertion as VerifyAssertion;
      const sessionName = requireSessionName(options);
      const result = await managedVerify(parseVerifyOptions(assertion, sessionName, options));
      if (result.data.passed) {
        printCommandResult("verify", result);
        return;
      }
      printCommandError("verify", {
        code: "VERIFY_FAILED",
        message: `verify ${assertion} failed`,
        retryable: Boolean(result.data.retryable),
        suggestions: Array.isArray(result.data.suggestions)
          ? result.data.suggestions.map(String)
          : [],
        details: result.data,
      });
      process.exitCode = 1;
    } catch (error) {
      printSessionAwareCommandError("verify", error, {
        code: "VERIFY_FAILED",
        message: "verify failed",
        suggestions: [
          "Use `pw verify text --session bug-a --text 'Saved'` for visible text",
          "Use `pw verify visible --session bug-a --selector '#submit'` for target state",
          "Use `pw verify url --session bug-a --contains '/dashboard'` for navigation",
        ],
      });
      process.exitCode = 1;
    }
  });
}
