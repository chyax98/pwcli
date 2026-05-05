import { defineCommand } from "citty";
import { managedStateLoad, managedStateSave } from "#engine/identity.js";
import {
  listProfileStates,
  removeProfileState,
  resolveProfileStatePath,
} from "#store/profile-state.js";
import { type CliArgs, firstPos, print, printError, session, withCliError } from "./_helpers.js";

const save = defineCommand({
  meta: {
    name: "save-state",
    description:
      "Purpose: save current session storage state into a named local profile.\nExamples:\n  pw profile save-state main-auth -s task-a\nNotes: use this after a verified login or setup flow.",
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
    const name = firstPos(a);
    if (!name) {
      printError("profile save-state", a, {
        code: "PROFILE_STATE_NAME_REQUIRED",
        message: "profile save-state requires a profile name",
      });
      return;
    }
    try {
      print(
        "profile save-state",
        await managedStateSave(resolveProfileStatePath(name), { sessionName: session(a) }),
        a,
      );
    } catch (error) {
      withCliError("profile save-state", a, error, "profile save-state failed");
    }
  },
});

const load = defineCommand({
  meta: {
    name: "load-state",
    description:
      "Purpose: load a named local state profile into the target session.\nExamples:\n  pw profile load-state main-auth -s task-a\nNotes: this mutates the session; verify page state after loading.",
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
    const name = firstPos(a);
    if (!name) {
      printError("profile load-state", a, {
        code: "PROFILE_STATE_NAME_REQUIRED",
        message: "profile load-state requires a profile name",
      });
      return;
    }
    try {
      print(
        "profile load-state",
        await managedStateLoad(resolveProfileStatePath(name), { sessionName: session(a) }),
        a,
      );
    } catch (error) {
      withCliError("profile load-state", a, error, "profile load-state failed");
    }
  },
});

const list = defineCommand({
  meta: {
    name: "list-state",
    description:
      "Purpose: list named local state profiles.\nExamples:\n  pw profile list-state\nNotes: use this to choose a stored state profile before loading it.",
  },
  args: {
    output: { type: "string", description: "Output format: text|json", default: "text" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const profiles = await listProfileStates();
      print("profile list-state", { data: { count: profiles.length, profiles } }, a);
    } catch (error) {
      withCliError("profile list-state", a, error, "profile list-state failed");
    }
  },
});

const remove = defineCommand({
  meta: {
    name: "remove-state",
    description:
      "Purpose: remove a named local state profile.\nExamples:\n  pw profile remove-state main-auth\nNotes: removal only affects the saved profile, not active browser sessions.",
  },
  args: {
    output: { type: "string", description: "Output format: text|json", default: "text" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    const name = firstPos(a);
    if (!name) {
      printError("profile remove-state", a, {
        code: "PROFILE_STATE_NAME_REQUIRED",
        message: "profile remove-state requires a profile name",
      });
      return;
    }
    try {
      print("profile remove-state", { data: await removeProfileState(name) }, a);
    } catch (error) {
      withCliError("profile remove-state", a, error, "profile remove-state failed");
    }
  },
});

export default {
  "save-state": save,
  "load-state": load,
  "list-state": list,
  "remove-state": remove,
};
