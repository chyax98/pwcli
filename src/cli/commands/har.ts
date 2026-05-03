import { defineCommand } from "citty";
import { managedHar, managedHarReplay, managedHarReplayStop } from "#engine/diagnose/har.js";
import { sharedArgs } from "#cli/args.js";
import { firstPos, print, session, str, withCliError, type CliArgs } from "./_helpers.js";

const start = defineCommand({ meta: { name: "start", description: "Start HAR recording" }, args: { ...sharedArgs, path: { type: "string", description: "HAR path", valueHint: "path" } }, async run({ args }) { const a = args as CliArgs; try { print("har start", await managedHar("start", { sessionName: session(a), path: str(a.path) ?? firstPos(a) }), a); } catch (e) { withCliError("har start", a, e); } } });
const stop = defineCommand({ meta: { name: "stop", description: "Stop HAR recording" }, args: sharedArgs, async run({ args }) { const a = args as CliArgs; try { print("har stop", await managedHar("stop", { sessionName: session(a) }), a); } catch (e) { withCliError("har stop", a, e); } } });
const replay = defineCommand({ meta: { name: "replay", description: "Replay from HAR" }, args: sharedArgs, async run({ args }) { const a = args as CliArgs; try { print("har replay", await managedHarReplay({ sessionName: session(a), filePath: firstPos(a) as string }), a); } catch (e) { withCliError("har replay", a, e); } } });
const replayStop = defineCommand({ meta: { name: "replay-stop", description: "Stop HAR replay" }, args: sharedArgs, async run({ args }) { const a = args as CliArgs; try { print("har replay-stop", await managedHarReplayStop({ sessionName: session(a) }), a); } catch (e) { withCliError("har replay-stop", a, e); } } });

export default defineCommand({ meta: { name: "har", description: "HAR controls" }, subCommands: { start, stop, replay, "replay-stop": replayStop } });
