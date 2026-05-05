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
  const descriptions: Record<string, string> = {
    current:
      "Purpose: show the current page projection.\nExamples:\n  pw page current -s task-a\nNotes: use this for URL/title/pageId facts.",
    list: "Purpose: list known pages and tabs in the workspace.\nExamples:\n  pw page list -s task-a\nNotes: use pageId values with `pw tab select` or `pw tab close`.",
    frames:
      "Purpose: list frames for the current page.\nExamples:\n  pw page frames -s task-a\nNotes: use this when content is inside iframes.",
    dialogs:
      "Purpose: show observed browser dialog events.\nExamples:\n  pw page dialogs -s task-a\nNotes: this is an event projection, not an authoritative live dialog set.",
    assess:
      "Purpose: assess page kind, signals, and recommended diagnostic next steps.\nExamples:\n  pw page assess -s task-a\nNotes: assessment is inference-only; verify with facts before acting.",
  };
  return defineCommand({
    meta: { name, description: descriptions[name] ?? `Page ${name}` },
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
