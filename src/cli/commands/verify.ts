import { defineCommand } from "citty";
import type { VerifyAssertion } from "#engine/observe.js";
import { managedVerify } from "#engine/observe.js";
import { actionArgs } from "#cli/args.js";
import { firstPos, num, print, session, stateTarget, str, withCliError, type CliArgs } from "./_helpers.js";

const assertions = ["text", "text-absent", "url", "visible", "hidden", "enabled", "disabled", "checked", "unchecked", "count"] as const;

export default defineCommand({
  meta: { name: "verify", description: "Assert page URL or target state" },
  args: { ...actionArgs, assertion: { type: "enum", options: assertions, description: "Assertion" }, contains: { type: "string", description: "URL substring", valueHint: "text" }, equals: { type: "string", description: "Expected exact value", valueHint: "value" }, matches: { type: "string", description: "Expected regex", valueHint: "regex" }, min: { type: "string", description: "Minimum count", valueHint: "n" }, max: { type: "string", description: "Maximum count", valueHint: "n" } },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const assertion = (a.assertion ?? firstPos(a)) as VerifyAssertion;
      if (!assertions.includes(assertion)) throw new Error(`unsupported verify assertion: ${String(assertion)}`);
      const target = assertion === "url" ? undefined : stateTarget(a);
      const url = assertion === "url" ? { contains: str(a.contains), equals: str(a.equals), matches: str(a.matches) } : undefined;
      const count = assertion === "count" ? { equals: num(a.equals), min: num(a.min), max: num(a.max) } : undefined;
      const result = await managedVerify({ sessionName: session(a), assertion, target, url, count });
      print("verify", result, a);
      if (result.data.passed === false) process.exitCode = 1;
    } catch (error) { withCliError("verify", a, error); }
  },
});
