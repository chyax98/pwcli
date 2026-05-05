import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedPress } from "#engine/act/element.js";
import { type CliArgs, positionals, print, session, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "press",
    description:
      "Purpose: press a keyboard key in the active page.\nExamples:\n  pw press -s task-a Enter\n  pw press -s task-a Escape\nNotes: use Playwright key names such as Enter, Escape, Tab, ArrowDown.",
  },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const key = positionals(a).join(" ");
      print("press", await managedPress(key, { sessionName: session(a) }), a);
    } catch (error) {
      withCliError("press", a, error, "press failed");
    }
  },
});
