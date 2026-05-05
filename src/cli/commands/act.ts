import { defineCommand } from "citty";
import type { IntentName } from "#engine/intents.js";
import { managedAct } from "#engine/intents.js";
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
    name: "act",
    description:
      "Purpose: resolve a built-in click intent and execute the best current-page action.\nOptions: intent is positional or --intent; current version only supports click-style intents.\nExamples:\n  pw act -s task-a submit_form\n  pw act -s task-a --intent accept_cookies\nNotes: act is a semantic shortcut, not a replacement for explicit wait/verify steps after the action.",
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
      description: "Intent to execute on the current page",
    },
    limit: {
      type: "string",
      description: "Candidate search breadth before picking the best",
      valueHint: "n",
      default: "5",
    },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const intent = (a.intent ?? firstPos(a)) as IntentName;
      if (!intents.includes(intent)) throw new Error(`unsupported intent: ${String(intent)}`);
      const result = await managedAct({
        sessionName: session(a),
        intent,
        limit: num(a.limit, 5),
      });
      print("act", result, a);
    } catch (error) {
      withCliError("act", a, error, "act failed");
    }
  },
});
