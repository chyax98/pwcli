import { defineCommand } from "citty";
import { actionArgs } from "#cli/args.js";
import type { VerifyAssertion } from "#engine/observe.js";
import { managedVerify } from "#engine/observe.js";
import {
  type CliArgs,
  firstPos,
  num,
  print,
  printError,
  session,
  stateTarget,
  str,
  withCliError,
} from "./_helpers.js";

const assertions = [
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
] as const;

export default defineCommand({
  meta: {
    name: "verify",
    description:
      "Purpose: run a read-only assertion against URL, text, element state or count.\nOptions: assertion is positional or --assertion; non-url assertions need a locator target; failed assertions return VERIFY_FAILED.\nExamples:\n  pw verify -s task-a url --contains '/dashboard'\n  pw verify -s task-a text --text 'Saved'\n  pw verify -s task-a text-absent --text 'Error'\nNotes: verify success means the condition passed; after VERIFY_FAILED read page facts or build a diagnostics bundle.",
  },
  args: {
    ...actionArgs,
    assertion: {
      type: "enum",
      options: assertions,
      description: "Assertion: text, text-absent, url, visibility, enabled, checked, or count",
    },
    contains: { type: "string", description: "URL substring", valueHint: "text" },
    equals: { type: "string", description: "Expected exact value", valueHint: "value" },
    matches: { type: "string", description: "Expected regex", valueHint: "regex" },
    min: { type: "string", description: "Minimum count", valueHint: "n" },
    max: { type: "string", description: "Maximum count", valueHint: "n" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const assertion = (a.assertion ?? firstPos(a)) as VerifyAssertion;
      if (!assertions.includes(assertion))
        throw new Error(`unsupported verify assertion: ${String(assertion)}`);
      const target = assertion === "url" ? undefined : stateTarget(a);
      const url =
        assertion === "url"
          ? { contains: str(a.contains), equals: str(a.equals), matches: str(a.matches) }
          : undefined;
      const count =
        assertion === "count"
          ? { equals: num(a.equals), min: num(a.min), max: num(a.max) }
          : undefined;
      const result = await managedVerify({
        sessionName: session(a),
        assertion,
        target,
        url,
        count,
      });
      if (result.data.passed === false) {
        printError("verify", a, {
          code: "VERIFY_FAILED",
          message: `verify ${assertion} failed`,
          retryable: Boolean(result.data.retryable),
          suggestions: result.data.suggestions ?? [],
          details: result.data as Record<string, unknown>,
        });
      } else {
        print("verify", result, a);
      }
    } catch (error) {
      withCliError("verify", a, error);
    }
  },
});
