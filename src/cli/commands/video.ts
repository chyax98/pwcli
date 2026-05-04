import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedVideoStart, managedVideoStop } from "#engine/act/page.js";
import { type CliArgs, print, session, withCliError } from "./_helpers.js";

const start = defineCommand({
  meta: { name: "start", description: "Start video recording" },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print("video start", await managedVideoStart({ sessionName: session(a) }), a);
    } catch (e) {
      withCliError("video start", a, e);
    }
  },
});
const stop = defineCommand({
  meta: { name: "stop", description: "Stop video recording" },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print("video stop", await managedVideoStop({ sessionName: session(a) }), a);
    } catch (e) {
      withCliError("video stop", a, e);
    }
  },
});
export default defineCommand({
  meta: { name: "video", description: "Video recording controls" },
  subCommands: { start, stop },
});
