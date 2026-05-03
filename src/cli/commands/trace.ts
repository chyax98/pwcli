import { defineCommand } from "citty";
import { managedTrace, managedTraceInspect } from "#engine/diagnose/trace.js";
import { sharedArgs } from "#cli/args.js";
import { bool, firstPos, num, print, printError, session, str, type CliArgs, withCliError } from "./_helpers.js";

const start = defineCommand({ meta: { name: "start", description: "Start tracing" }, args: sharedArgs, async run({ args }) { const a = args as CliArgs; try { print("trace start", await managedTrace("start", { sessionName: session(a) }), a); } catch (e) { withCliError("trace start", a, e); } } });
const stop = defineCommand({ meta: { name: "stop", description: "Stop tracing" }, args: sharedArgs, async run({ args }) { const a = args as CliArgs; try { print("trace stop", await managedTrace("stop", { sessionName: session(a) }), a); } catch (e) { withCliError("trace stop", a, e); } } });
const inspect = defineCommand({ meta: { name: "inspect", description: "Inspect a trace archive" }, args: { ...sharedArgs, section: { type: "enum", options: ["actions", "requests", "console", "errors"], description: "Section", default: "actions" }, failed: { type: "boolean", description: "Failed requests only" }, level: { type: "string", description: "Console level", valueHint: "level" }, limit: { type: "string", description: "Output line limit", valueHint: "n" } }, async run({ args }) { const a = args as CliArgs; try { print("trace inspect", await managedTraceInspect({ tracePath: firstPos(a) as string, section: a.section as "actions" | "requests" | "console" | "errors", failed: bool(a.failed), level: str(a.level), limit: num(a.limit) }), a); } catch (e) { printError("trace inspect", a, { code: (e as { code?: string }).code ?? "TRACE_INSPECT_FAILED", message: e instanceof Error ? e.message : String(e), details: (e as { details?: Record<string, unknown> }).details }); } } });

export default defineCommand({ meta: { name: "trace", description: "Manage and inspect traces" }, subCommands: { start, stop, inspect } });
