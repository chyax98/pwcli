import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedDialog } from "#engine/act/page.js";
import { type CliArgs, firstPos, print, session, withCliError } from "./_helpers.js";

const accept = defineCommand({
  meta: { name: "accept", description: "Accept the current dialog" },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print(
        "dialog accept",
        await managedDialog("accept", { sessionName: session(a), prompt: firstPos(a) }),
        a,
      );
    } catch (error) {
      withCliError("dialog accept", a, error);
    }
  },
});

const dismiss = defineCommand({
  meta: { name: "dismiss", description: "Dismiss the current dialog" },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print("dialog dismiss", await managedDialog("dismiss", { sessionName: session(a) }), a);
    } catch (error) {
      withCliError("dialog dismiss", a, error);
    }
  },
});

export default defineCommand({
  meta: {
    name: "dialog",
    description:
      "Purpose: accept or dismiss the current browser dialog.\nExamples:\n  pw dialog accept -s task-a\n  pw dialog dismiss -s task-a\nNotes: use this only for native browser dialogs; page HTML modals are handled with normal locators.",
  },
  subCommands: { accept, dismiss },
});
