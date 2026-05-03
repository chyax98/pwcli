import { defineCommand } from "citty";
import { managedResize } from "#engine/act/page.js";
import { sharedArgs } from "#cli/args.js";
import { num, positionals, print, session, str, withCliError, type CliArgs } from "./_helpers.js";

const presets: Record<string, [number, number]> = { iphone: [390, 844], ipad: [820, 1180], desktop: [1440, 900] };

export default defineCommand({
  meta: { name: "resize", description: "Resize the browser viewport" },
  args: { ...sharedArgs, width: { type: "string", description: "Viewport width", valueHint: "px" }, height: { type: "string", description: "Viewport height", valueHint: "px" }, preset: { type: "string", description: "Viewport preset", valueHint: "name" }, view: { type: "string", description: "Viewport label", valueHint: "name" } },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const parts = positionals(a);
      const preset = str(a.preset);
      const size = preset ? presets[preset] : undefined;
      const width = num(a.width ?? parts[0], size?.[0] ?? 1280) as number;
      const height = num(a.height ?? parts[1], size?.[1] ?? 720) as number;
      print("resize", await managedResize({ sessionName: session(a), width, height, preset, view: str(a.view) }), a);
    } catch (error) {
      withCliError("resize", a, error, "resize failed");
    }
  },
});
