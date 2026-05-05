import { defineCommand } from "citty";
import { clearControlState, readControlState, writeControlState } from "#store/control-state.js";
import { type CliArgs, print, session, str, withCliError } from "./_helpers.js";

const state = defineCommand({
  meta: {
    name: "control-state",
    description: "Show whether a session is under CLI or human control",
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
  meta: { name: "takeover", description: "Mark a session as human-controlled" },
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
  meta: { name: "release-control", description: "Return a session to CLI control" },
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
