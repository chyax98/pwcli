import { defineCommand } from "citty";
import { clearControlState, readControlState, writeControlState } from "#store/control-state.js";
import { type CliArgs, print, session, str, withCliError } from "./_helpers.js";

const state = defineCommand({
  meta: {
    name: "control-state",
    description:
      "Purpose: show whether a session is under CLI or human control.\nExamples:\n  pw control-state -s task-a\nNotes: use this before resuming automation on a session that a human may have taken over.",
  },
  args: {
    session: {
      type: "string",
      alias: "s",
      description: "Target managed session",
      valueHint: "name",
    },
    output: { type: "string", description: "Output format: text|json", default: "text" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const sessionName = session(a);
      const current = await readControlState(sessionName);
      print(
        "control-state",
        {
          data: current ?? {
            sessionName,
            state: "cli",
            actor: "agent",
            updatedAt: null,
          },
        },
        a,
      );
    } catch (error) {
      withCliError("control-state", a, error, "control-state failed");
    }
  },
});

const takeover = defineCommand({
  meta: {
    name: "takeover",
    description:
      "Purpose: mark a session as human-controlled so write operations stop.\nExamples:\n  pw takeover -s task-a --actor tester --reason 'manual inspection'\nNotes: this is not approval; it is a hard control gate until `release-control`.",
  },
  args: {
    session: {
      type: "string",
      alias: "s",
      description: "Target managed session",
      valueHint: "name",
    },
    output: { type: "string", description: "Output format: text|json", default: "text" },
    actor: { type: "string", description: "Actor label", default: "human" },
    reason: { type: "string", description: "Optional takeover reason" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const record = {
        sessionName: session(a),
        state: "human" as const,
        actor: str(a.actor) ?? "human",
        reason: str(a.reason) ?? null,
        updatedAt: new Date().toISOString(),
      };
      await writeControlState(record);
      print("takeover", { data: record }, a);
    } catch (error) {
      withCliError("takeover", a, error, "takeover failed");
    }
  },
});

const release = defineCommand({
  meta: {
    name: "release-control",
    description:
      "Purpose: return a human-controlled session to CLI automation.\nExamples:\n  pw release-control -s task-a\nNotes: run this only after the human has finished interacting with the browser.",
  },
  args: {
    session: {
      type: "string",
      alias: "s",
      description: "Target managed session",
      valueHint: "name",
    },
    output: { type: "string", description: "Output format: text|json", default: "text" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const sessionName = session(a);
      await clearControlState(sessionName);
      print(
        "release-control",
        {
          data: {
            sessionName,
            state: "cli",
            actor: "agent",
            updatedAt: new Date().toISOString(),
          },
        },
        a,
      );
    } catch (error) {
      withCliError("release-control", a, error, "release-control failed");
    }
  },
});

export default {
  "control-state": state,
  takeover,
  "release-control": release,
};
