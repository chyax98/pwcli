import { defineCommand } from "citty";
import { managedLocate } from "#engine/observe.js";
import { actionArgs } from "#cli/args.js";
import { bool, print, session, stateTarget, withCliError, type CliArgs } from "./_helpers.js";

export default defineCommand({
  meta: { name: "locate", description: "Locate state target candidates" },
  args: { ...actionArgs, nth: { ...actionArgs.nth, default: undefined }, "return-ref": { type: "boolean", description: "Try returning a fresh snapshot ref", alias: ["ref"] } },
  async run({ args }) {
    const a = args as CliArgs;
    try { print("locate", await managedLocate({ sessionName: session(a), target: stateTarget(a), returnRef: bool(a["return-ref"]) }), a); } catch (error) { withCliError("locate", a, error); }
  },
});
