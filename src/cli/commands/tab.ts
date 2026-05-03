import { defineCommand } from "citty";
import { managedTabClose, managedTabSelect } from "#engine/workspace.js";
import { sharedArgs } from "#cli/args.js";
import { firstPos, print, session, withCliError, type CliArgs } from "./_helpers.js";

const select = defineCommand({ meta: { name: "select", description: "Select a tab by pageId" }, args: sharedArgs, async run({ args }) { const a = args as CliArgs; try { print("tab select", await managedTabSelect({ sessionName: session(a), pageId: firstPos(a) as string }), a); } catch (e) { withCliError("tab select", a, e); } } });
const close = defineCommand({ meta: { name: "close", description: "Close a tab by pageId" }, args: sharedArgs, async run({ args }) { const a = args as CliArgs; try { print("tab close", await managedTabClose({ sessionName: session(a), pageId: firstPos(a) as string }), a); } catch (e) { withCliError("tab close", a, e); } } });

export default defineCommand({ meta: { name: "tab", description: "Select or close browser tabs by stable pageId" }, subCommands: { select, close } });
