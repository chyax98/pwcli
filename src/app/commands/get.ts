import type { Command } from "commander";
import { managedGetFact } from "../../domain/interaction/service.js";
import { printCommandError, printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";
import { parseStateTarget, type StateTargetOptions } from "./state-target.js";

const facts = new Set(["text", "value", "count"]);

export function registerGetCommand(program: Command): void {
  addSessionOption(
    program
      .command("get <fact>")
      .description("Read a compact fact from a target: text, value, or count")
      .option("--selector <selector>", "CSS selector")
      .option("--text <text>", "Exact text locator")
      .option("--role <role>", "Role locator")
      .option("--name <name>", "Accessible name for --role")
      .option("--testid <id>", "Test id locator"),
  ).action(async (fact: string, options: StateTargetOptions & { session?: string }) => {
    try {
      const sessionName = requireSessionName(options);
      if (!facts.has(fact)) {
        throw new Error("get fact must be one of: text, value, count");
      }
      printCommandResult(
        "get",
        await managedGetFact({
          sessionName,
          fact: fact as "text" | "value" | "count",
          target: parseStateTarget(options),
        }),
      );
    } catch (error) {
      const notFound = stateTargetNotFound(error);
      if (notFound) {
        printCommandError("get", {
          code: "STATE_TARGET_NOT_FOUND",
          message: "state target was not found",
          retryable: true,
          suggestions: [
            "Run `pw locate --session <name> --selector '<selector>'` to inspect candidates",
            "Use `pw get count --session <name> --selector '<selector>'` when zero matches is acceptable",
            "Use `pw snapshot -i --session <name>` when you need fresh refs",
          ],
          details: notFound,
        });
        process.exitCode = 1;
        return;
      }
      printSessionAwareCommandError("get", error, {
        code: "GET_FAILED",
        message: "get failed",
        suggestions: [
          "Use `pw get text --session bug-a --selector '#result'`",
          "Use `pw get value --session bug-a --selector '#email'` for form controls",
          "Use `pw get count --session bug-a --selector '.row'` before choosing a narrower target",
        ],
      });
      process.exitCode = 1;
    }
  });
}

function stateTargetNotFound(error: unknown): Record<string, unknown> | null {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/STATE_TARGET_NOT_FOUND:(\{.*\})/s);
  if (!match) {
    return null;
  }
  try {
    const parsed = JSON.parse(match[1]);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
