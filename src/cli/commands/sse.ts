import { defineCommand } from "citty";
import { managedDiagnosticsExport } from "#engine/diagnose/export.js";
import { sharedArgs } from "#cli/args.js";
import { num, print, session, str, withCliError, type CliArgs } from "./_helpers.js";

export default defineCommand({
  meta: { name: "sse", description: "Inspect captured SSE records" },
  args: { ...sharedArgs, since: { type: "string", description: "Since ISO time", valueHint: "iso" }, limit: { type: "string", description: "Limit", default: "50", valueHint: "n" }, url: { type: "string", description: "URL substring", valueHint: "url" } },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const exported = await managedDiagnosticsExport({ sessionName: session(a) });
      const data = exported.data as Record<string, unknown>;
      const since = str(a.since);
      const sinceTime = since ? Date.parse(since) : null;
      const url = str(a.url);
      const records = (Array.isArray(data.sse) ? data.sse : [])
        .filter((item) => !sinceTime || Date.parse(String((item as Record<string, unknown>).timestamp ?? "")) >= sinceTime)
        .filter((item) => !url || String((item as Record<string, unknown>).url ?? "").includes(url))
        .slice(-(num(a.limit, 50) as number));
      print("sse", { session: exported.session as Record<string, unknown>, page: exported.page as Record<string, unknown>, data: { count: records.length, records } }, a);
    } catch (error) { withCliError("sse", a, error); }
  },
});
