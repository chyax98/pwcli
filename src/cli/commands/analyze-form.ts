import { defineCommand } from "citty";
import { managedAnalyzeForm } from "#engine/forms.js";
import { type CliArgs, print, session, str, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "analyze-form",
    description:
      "Purpose: inspect the current page form structure and return field metadata.\nOptions: defaults to the first form; use --selector to scope to a specific form.\nExamples:\n  pw analyze-form -s task-a\n  pw analyze-form -s task-a --selector '#login-form'\nNotes: analyze-form is read-only and returns labels, names, placeholders, field kinds and option lists.",
  },
  args: {
    session: {
      type: "string",
      alias: "s",
      description: "Target managed session",
      valueHint: "name",
    },
    output: { type: "string", description: "Output format: text|json", default: "text" },
    selector: { type: "string", description: "CSS selector for the form root", valueHint: "css" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print(
        "analyze-form",
        await managedAnalyzeForm({ sessionName: session(a), selector: str(a.selector) }),
        a,
      );
    } catch (error) {
      withCliError("analyze-form", a, error, "analyze-form failed");
    }
  },
});
