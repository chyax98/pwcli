import { defineCommand } from "citty";
import { listChromeProfiles } from "#engine/environment.js";
import { type CliArgs, print, withCliError } from "./_helpers.js";
import authCommands from "./profile-auth.js";
import stateCommands from "./profile-state.js";

const listChrome = defineCommand({
  meta: { name: "list-chrome", description: "List local Chrome profiles" },
  args: {
    "user-data-dir": { type: "string", description: "Chrome user data dir", valueHint: "path" },
    output: { type: "string", description: "Output format: text|json", default: "text" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const profiles = await listChromeProfiles({
        userDataDir: typeof a["user-data-dir"] === "string" ? a["user-data-dir"] : undefined,
      });
      print("profile list-chrome", { data: { count: profiles.length, profiles } }, a);
    } catch (e) {
      withCliError("profile list-chrome", a, e);
    }
  },
});
export default defineCommand({
  meta: {
    name: "profile",
    description:
      "Purpose: list local Chrome profiles and manage reusable state or encrypted auth profiles.\nExamples:\n  pw profile list-chrome\n  pw profile save-state main -s task-a\nNotes: auth profiles require `PWCLI_VAULT_KEY`; state/auth load commands mutate the target session.",
  },
  subCommands: { "list-chrome": listChrome, ...stateCommands, ...authCommands },
});
