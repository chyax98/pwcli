import { defineCommand } from "citty";
import { managedSnapshot } from "#engine/observe.js";
import { managedSnapshotStatus } from "#engine/act/element.js";
import { sharedArgs } from "#cli/args.js";
import { bool, firstPos, print, session, withCliError, type CliArgs } from "./_helpers.js";

const status = defineCommand({
  meta: { name: "status", description: "Inspect latest snapshot ref epoch" },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try { print("snapshot status", await managedSnapshotStatus({ sessionName: session(a) }), a); } catch (error) { withCliError("snapshot status", a, error); }
  },
});

export default defineCommand({
  meta: { name: "snapshot", description: "Capture an accessibility snapshot" },
  args: { ...sharedArgs, interactive: { type: "boolean", alias: "i", description: "Return only likely interactive lines" }, compact: { type: "boolean", alias: "c", description: "Compact structural output" } },
  subCommands: { status },
  async run({ args }) {
    const a = args as CliArgs;
    if (firstPos(a) === "status") return;
    try {
      print("snapshot", await managedSnapshot({ sessionName: session(a), interactive: bool(a.interactive), compact: bool(a.compact) }), a);
    } catch (error) {
      withCliError("snapshot", a, error, "snapshot failed");
    }
  },
});
