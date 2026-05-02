import { type Command, Option } from "commander";
import { managedGetFact } from "../../infra/playwright/runtime.js";
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
      .option("--label <label>", "Exact label locator")
      .option("--placeholder <text>", "Exact placeholder locator")
      .option("--test-id <id>", "Test id locator")
      .addOption(new Option("--testid <id>").hideHelp())
      .option("--nth <number>", "1-based match index")
      .option(
        "--return-ref",
        "Return the aria snapshot ref of the matched element (text/value only)",
      ),
  ).action(
    async (
      fact: string,
      options: StateTargetOptions & { session?: string; returnRef?: boolean },
    ) => {
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
            returnRef: options.returnRef,
          }),
        );
      } catch (error) {
        const notFound = stateTargetNotFound(error);
        if (notFound) {
          const target = notFound.target as Record<string, unknown> | undefined;
          const targetDesc = target
            ? Object.entries(target)
                .filter(([k]) => k !== "nth")
                .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                .join(" ")
            : "";
          printCommandError("get", {
            code: "STATE_TARGET_NOT_FOUND",
            message: `target not found${targetDesc ? `: ${targetDesc}` : ""}`,
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
    },
  );
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
