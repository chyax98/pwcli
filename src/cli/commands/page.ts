import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import {
  managedPageAssess,
  managedPageCurrent,
  managedPageDialogs,
  managedPageFrames,
  managedPageList,
} from "#engine/workspace.js";
import { type CliArgs, print, session, withCliError } from "./_helpers.js";

function sub(name: string, fn: (sessionName: string) => Promise<Parameters<typeof print>[1]>) {
  return defineCommand({
    meta: { name, description: `Page ${name}` },
    args: sharedArgs,
    async run({ args }) {
      const a = args as CliArgs;
      try {
        print(`page ${name}`, await fn(session(a)), a);
      } catch (e) {
        withCliError(`page ${name}`, a, e);
      }
    },
  });
}

export default defineCommand({
  meta: {
    name: "page",
    description:
      "Purpose: inspect page, tab, frame, dialog and page-assessment state.\nExamples:\n  pw page current -s task-a\n  pw page assess -s task-a\nNotes: page commands are read-only projections; `page dialogs` reports observed dialog events, not a guaranteed live set.",
  },
  subCommands: {
    current: sub("current", (sessionName) => managedPageCurrent({ sessionName })),
    list: sub("list", (sessionName) => managedPageList({ sessionName })),
    frames: sub("frames", (sessionName) => managedPageFrames({ sessionName })),
    dialogs: sub("dialogs", (sessionName) => managedPageDialogs({ sessionName })),
    assess: sub("assess", (sessionName) => managedPageAssess({ sessionName })),
  },
});
