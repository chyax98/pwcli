import { defineCommand } from "citty";
import { managedVideoStart, managedVideoStop } from "#engine/act/page.js";
import { sharedArgs } from "#cli/args.js";
import { print, session, withCliError, type CliArgs } from "./_helpers.js";

const start = defineCommand({ meta: { name: "start", description: "Start video recording" }, args: sharedArgs, async run({ args }) { const a = args as CliArgs; try { print("video start", await managedVideoStart({ sessionName: session(a) }), a); } catch (e) { withCliError("video start", a, e); } } });
const stop = defineCommand({ meta: { name: "stop", description: "Stop video recording" }, args: sharedArgs, async run({ args }) { const a = args as CliArgs; try { print("video stop", await managedVideoStop({ sessionName: session(a) }), a); } catch (e) { withCliError("video stop", a, e); } } });
export default defineCommand({ meta: { name: "video", description: "Video recording controls" }, subCommands: { start, stop } });
