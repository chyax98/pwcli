import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedScroll } from "#engine/act/page.js";
import { type CliArgs, num, positionals, print, session, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: { name: "scroll", description: "Scroll the current page" },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const parts = positionals(a);
      print(
        "scroll",
        await managedScroll({
          sessionName: session(a),
          direction: parts[0] as "up" | "down" | "left" | "right",
          distance: num(parts[1]),
        }),
        a,
      );
    } catch (error) {
      withCliError("scroll", a, error, "scroll failed");
    }
  },
});
