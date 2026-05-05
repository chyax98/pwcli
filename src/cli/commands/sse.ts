import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedDiagnosticsExport } from "#engine/diagnose/export.js";
import { type CliArgs, num, print, session, str, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "sse",
    description:
      "Purpose: inspect captured Server-Sent Events records from session diagnostics.\nExamples:\n  pw sse -s task-a --limit 20\n  pw sse -s task-a --url /events --since 2026-01-01T00:00:00.000Z\nNotes: use this with `network` and page facts when debugging streaming UI updates.",
  },
  args: {
    ...sharedArgs,
    since: { type: "string", description: "Since ISO time", valueHint: "iso" },
    limit: { type: "string", description: "Limit", default: "50", valueHint: "n" },
    url: { type: "string", description: "URL substring", valueHint: "url" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const exported = await managedDiagnosticsExport({ sessionName: session(a) });
      const data = exported.data as Record<string, unknown>;
      const since = str(a.since);
      const sinceTime = since ? Date.parse(since) : null;
      const url = str(a.url);
      const records = (Array.isArray(data.sse) ? data.sse : [])
        .filter(
          (item) =>
            !sinceTime ||
            Date.parse(String((item as Record<string, unknown>).timestamp ?? "")) >= sinceTime,
        )
        .filter((item) => !url || String((item as Record<string, unknown>).url ?? "").includes(url))
        .slice(-(num(a.limit, 50) as number));
      print(
        "sse",
        {
          session: exported.session as Record<string, unknown>,
          page: exported.page as Record<string, unknown>,
          data: { count: records.length, records },
        },
        a,
      );
    } catch (error) {
      withCliError("sse", a, error);
    }
  },
});
