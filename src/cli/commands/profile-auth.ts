import { readFile } from "node:fs/promises";
import { defineCommand } from "citty";
import { managedFillForm } from "#engine/forms.js";
import { managedAct } from "#engine/intents.js";
import { managedRunCode } from "#engine/shared.js";
import { assertActionAllowed } from "#store/action-policy.js";
import {
  listAuthProfiles,
  loadAuthProfile,
  removeAuthProfile,
  saveAuthProfile,
} from "#store/auth-profile.js";
import { assertSessionAutomationControl } from "#store/control-state.js";
import {
  type CliArgs,
  firstPos,
  print,
  printError,
  session,
  str,
  withCliError,
} from "./_helpers.js";

async function readValues(args: CliArgs) {
  const file = str(args.file);
  const raw = file ? await readFile(file, "utf8") : str(args.values);
  if (!raw) {
    throw new Error("profile save-auth requires --values <json> or --file <path>");
  }
  const parsed = JSON.parse(raw) as Record<string, string>;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("auth profile values must be a JSON object");
  }
  return parsed;
}

const save = defineCommand({
  meta: { name: "save-auth", description: "Save an encrypted named auth profile" },
  args: {
    output: { type: "string", description: "Output format: text|json", default: "text" },
    url: { type: "string", description: "Login URL", valueHint: "url" },
    values: { type: "string", description: "JSON values object", valueHint: "json" },
    file: { type: "string", description: "Path to JSON values object", valueHint: "path" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    const name = firstPos(a);
    if (!name || !str(a.url)) {
      printError("profile save-auth", a, {
        code: "PROFILE_AUTH_INPUT_REQUIRED",
        message: "profile save-auth requires a profile name and --url",
      });
      return;
    }
    try {
      print(
        "profile save-auth",
        {
          data: await saveAuthProfile(name, {
            url: str(a.url) as string,
            values: await readValues(a),
          }),
        },
        a,
      );
    } catch (error) {
      withCliError("profile save-auth", a, error, "profile save-auth failed");
    }
  },
});

const login = defineCommand({
  meta: {
    name: "login-auth",
    description: "Load a saved auth profile, open its URL, run fill-form, and act submit_form",
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
      printError("profile login-auth", a, {
        code: "PROFILE_AUTH_NAME_REQUIRED",
        message: "profile login-auth requires a profile name",
      });
      return;
    }
    try {
      const { profile } = await loadAuthProfile(name);
      await assertActionAllowed("navigate", "profile login-auth");
      await assertSessionAutomationControl(session(a), "profile login-auth");
      await managedRunCode({
        sessionName: session(a),
        source: `async page => {
          await page.goto(${JSON.stringify(profile.url)}, { waitUntil: "domcontentloaded" });
          return { url: page.url() };
        }`,
      });
      await managedFillForm({
        sessionName: session(a),
        values: profile.values,
      });
      await assertActionAllowed("fill", "profile login-auth");
      const acted = await managedAct({
        sessionName: session(a),
        intent: "submit_form",
      });
      print(
        "profile login-auth",
        {
          session: acted.session,
          page: acted.page,
          data: {
            profile: name,
            url: profile.url,
            loggedIn: true,
            ...acted.data,
          },
        },
        a,
      );
    } catch (error) {
      withCliError("profile login-auth", a, error, "profile login-auth failed");
    }
  },
});

const list = defineCommand({
  meta: { name: "list-auth", description: "List encrypted named auth profiles" },
  args: {
    output: { type: "string", description: "Output format: text|json", default: "text" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const profiles = await listAuthProfiles();
      print("profile list-auth", { data: { count: profiles.length, profiles } }, a);
    } catch (error) {
      withCliError("profile list-auth", a, error, "profile list-auth failed");
    }
  },
});

const remove = defineCommand({
  meta: { name: "remove-auth", description: "Remove an encrypted named auth profile" },
  args: {
    output: { type: "string", description: "Output format: text|json", default: "text" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    const name = firstPos(a);
    if (!name) {
      printError("profile remove-auth", a, {
        code: "PROFILE_AUTH_NAME_REQUIRED",
        message: "profile remove-auth requires a profile name",
      });
      return;
    }
    try {
      print("profile remove-auth", { data: await removeAuthProfile(name) }, a);
    } catch (error) {
      withCliError("profile remove-auth", a, error, "profile remove-auth failed");
    }
  },
});

export default {
  "save-auth": save,
  "login-auth": login,
  "list-auth": list,
  "remove-auth": remove,
};
