import { defineCommand } from "citty";
import type { IntentName } from "#engine/intents.js";
import { managedFindBest } from "#engine/intents.js";
import { type CliArgs, firstPos, num, print, session, withCliError } from "./_helpers.js";

const intents = [
  "submit_form",
  "close_dialog",
  "auth_action",
  "accept_cookies",
  "back_navigation",
  "pagination_next",
  "primary_cta",
] as const satisfies IntentName[];

export default defineCommand({
  meta: {
    name: "find-best",
    description:
      "Purpose: rank the best current-page candidates for a built-in agent intent.\nOptions: intent is positional or --intent; --limit bounds returned candidates.\nExamples:\n  pw find-best -s task-a submit_form\n  pw find-best -s task-a --intent accept_cookies --limit 3\nNotes: find-best is a semantic shortcut over locate/snapshot, not a general planner.",
  },
  args: {
    session: {
      type: "string",
      alias: "s",
      description: "Target managed session",
      valueHint: "name",
    },
    output: { type: "string", description: "Output format: text|json", default: "text" },
    intent: {
      type: "enum",
      options: intents,
      description: "Intent to rank against the current page",
    },
    limit: {
      type: "string",
      description: "Maximum candidates to return",
      valueHint: "n",
      default: "5",
    },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const intent = (a.intent ?? firstPos(a)) as IntentName;
      if (!intents.includes(intent)) throw new Error(`unsupported intent: ${String(intent)}`);
      const result = await managedFindBest({
        sessionName: session(a),
        intent,
        limit: num(a.limit, 5),
      });
      print("find-best", result, a);
    } catch (error) {
      withCliError("find-best", a, error, "find-best failed");
    }
  },
});
