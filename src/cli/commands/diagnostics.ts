import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import {
  applyDiagnosticsExportFilter,
  buildSessionDigest,
  buildSessionTimeline,
  listDiagnosticsRuns,
  managedDiagnosticsBundle,
  managedDiagnosticsExport,
  readDiagnosticsRunDigest,
  readDiagnosticsRunView,
  writeDiagnosticsExportFile,
} from "#engine/diagnose/export.js";
import { type CliArgs, firstPos, num, print, session, str, withCliError } from "./_helpers.js";

const exportCmd = defineCommand({
  meta: {
    name: "export",
    description:
      "Purpose: export captured diagnostics records from a session.\nExamples:\n  pw diagnostics export -s task-a --section network --limit 20\n  pw diagnostics export -s task-a --out ./diagnostics.json\nNotes: use export for raw evidence; use digest or timeline for summarized diagnosis.",
  },
  args: {
    ...sharedArgs,
    out: { type: "string", description: "Output JSON file", valueHint: "path" },
    section: { type: "string", description: "Section", valueHint: "section" },
    limit: { type: "string", description: "Limit", valueHint: "n" },
    since: { type: "string", description: "Since ISO", valueHint: "iso" },
    text: { type: "string", description: "Text filter", valueHint: "text" },
    fields: { type: "string", description: "Fields projection", valueHint: "fields" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const sn = session(a);
      const filtered = applyDiagnosticsExportFilter(
        await managedDiagnosticsExport({ sessionName: sn }),
        {
          section: str(a.section) as never,
          limit: num(a.limit),
          since: str(a.since),
          text: str(a.text),
          fields: str(a.fields),
        },
      );
      const out = str(a.out);
      if (out) await writeDiagnosticsExportFile(out, filtered.data);
      print(
        "diagnostics export",
        {
          session: filtered.session as Record<string, unknown>,
          page: filtered.page as Record<string, unknown>,
          data: { ...filtered.data, exported: Boolean(out), ...(out ? { out } : {}) },
        },
        a,
      );
    } catch (e) {
      withCliError("diagnostics export", a, e);
    }
  },
});
const bundle = defineCommand({
  meta: {
    name: "bundle",
    description:
      "Purpose: build a handoff evidence bundle for one session.\nOptions: --out writes manifest.json and handoff.md; --task labels the manifest; --limit bounds included evidence.\nExamples:\n  pw diagnostics bundle -s bug-a --out .pwcli/bundles/bug-a --task 'login failure'\nNotes: bundle records facts for handoff; it does not bypass blocked sessions or replace dialog/modal recovery.",
  },
  args: {
    ...sharedArgs,
    out: { type: "string", description: "Output bundle directory", valueHint: "dir" },
    task: { type: "string", description: "Task label for handoff manifest", valueHint: "text" },
    limit: { type: "string", description: "Limit", default: "20", valueHint: "n" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const sn = session(a);
      const outDir = str(a.out);
      const exported = await managedDiagnosticsExport({ sessionName: sn });
      const result = await managedDiagnosticsBundle({
        sessionName: sn,
        limit: num(a.limit),
        exported,
        outDir,
        task: str(a.task),
      });
      print(
        "diagnostics bundle",
        {
          ...result,
          data: {
            ...result.data,
            ...(outDir
              ? {
                  out: outDir,
                  manifest: `${outDir}/manifest.json`,
                  handoff: `${outDir}/handoff.md`,
                }
              : {}),
          },
        } as Parameters<typeof print>[1],
        a,
      );
    } catch (e) {
      withCliError("diagnostics bundle", a, e);
    }
  },
});
const runs = defineCommand({
  meta: {
    name: "runs",
    description:
      "Purpose: list recorded command/action runs.\nExamples:\n  pw diagnostics runs -s task-a --limit 20\n  pw diagnostics runs --since 2026-01-01T00:00:00.000Z\nNotes: use run ids with `diagnostics show`, `grep`, or `digest --run`.",
  },
  args: {
    ...sharedArgs,
    limit: { type: "string", description: "Limit", valueHint: "n" },
    since: { type: "string", description: "Since ISO", valueHint: "iso" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const sn = str(a.session);
      const items = await listDiagnosticsRuns({
        sessionName: sn,
        limit: num(a.limit),
        since: str(a.since),
      });
      print("diagnostics runs", { data: { count: items.length, runs: items } }, a);
    } catch (e) {
      withCliError("diagnostics runs", a, e);
    }
  },
});
const digest = defineCommand({
  meta: {
    name: "digest",
    description:
      "Purpose: summarize high-signal diagnostics for a session or recorded run.\nExamples:\n  pw diagnostics digest -s task-a\n  pw diagnostics digest --run <runId> --limit 10\nNotes: use this first when diagnosing a failed workflow.",
  },
  args: {
    ...sharedArgs,
    run: { type: "string", description: "Run id", valueHint: "id" },
    limit: { type: "string", description: "Limit", default: "5", valueHint: "n" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      if (str(a.run)) {
        print(
          "diagnostics digest",
          {
            data: {
              source: "run",
              ...(await readDiagnosticsRunDigest({
                runId: str(a.run) as string,
                limit: num(a.limit, 5),
              })),
            },
          },
          a,
        );
        return;
      }
      const sn = session(a);
      print(
        "diagnostics digest",
        buildSessionDigest(
          await managedDiagnosticsExport({ sessionName: sn }),
          num(a.limit, 5) as number,
        ) as Parameters<typeof print>[1],
        a,
      );
    } catch (e) {
      withCliError("diagnostics digest", a, e);
    }
  },
});
const show = defineCommand({
  meta: {
    name: "show",
    description:
      "Purpose: show recorded events for a run.\nExamples:\n  pw diagnostics show --run <runId>\n  pw diagnostics show --run <runId> --command click\nNotes: use this for precise evidence after a digest identifies the relevant run.",
  },
  args: {
    ...sharedArgs,
    run: { type: "string", description: "Run id", valueHint: "id" },
    command: { type: "string", description: "Command filter", valueHint: "name" },
    text: { type: "string", description: "Text filter", valueHint: "text" },
    limit: { type: "string", description: "Limit", valueHint: "n" },
    since: { type: "string", description: "Since ISO", valueHint: "iso" },
    fields: { type: "string", description: "Fields", valueHint: "fields" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print(
        "diagnostics show",
        {
          data: await readDiagnosticsRunView({
            runId: (str(a.run) ?? firstPos(a)) as string,
            command: str(a.command),
            text: str(a.text),
            limit: num(a.limit),
            since: str(a.since),
            fields: str(a.fields),
          }),
        },
        a,
      );
    } catch (e) {
      withCliError("diagnostics show", a, e);
    }
  },
});
const grep = defineCommand({
  ...show,
  meta: {
    name: "grep",
    description:
      "Purpose: search recorded run events by command or text.\nExamples:\n  pw diagnostics grep --run <runId> --text TypeError\n  pw diagnostics grep --run <runId> --command click\nNotes: use grep to find a specific signal inside a larger recorded run.",
  },
});
const timeline = defineCommand({
  meta: {
    name: "timeline",
    description:
      "Purpose: build a chronological diagnostics timeline for a session.\nExamples:\n  pw diagnostics timeline -s task-a --limit 50\n  pw diagnostics timeline -s task-a --since 2026-01-01T00:00:00.000Z\nNotes: use timeline to explain what changed before a failure.",
  },
  args: {
    ...sharedArgs,
    limit: { type: "string", description: "Limit", default: "50", valueHint: "n" },
    since: { type: "string", description: "Since ISO", valueHint: "iso" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const sn = session(a);
      const exported = await managedDiagnosticsExport({ sessionName: sn });
      print(
        "diagnostics timeline",
        {
          session: exported.session as Record<string, unknown>,
          page: exported.page as Record<string, unknown>,
          data: await buildSessionTimeline({
            sessionName: sn,
            limit: num(a.limit),
            since: str(a.since),
            exported,
          }),
        },
        a,
      );
    } catch (e) {
      withCliError("diagnostics timeline", a, e);
    }
  },
});

export default defineCommand({
  meta: { name: "diagnostics", description: "Diagnostics export, runs, digest and bundle" },
  subCommands: { export: exportCmd, bundle, runs, digest, show, grep, timeline },
});
