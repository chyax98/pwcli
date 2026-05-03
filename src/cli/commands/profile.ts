import { defineCommand } from "citty";
import { listChromeProfiles } from "#engine/environment.js";
import { print, withCliError, type CliArgs } from "./_helpers.js";

const listChrome = defineCommand({ meta: { name: "list-chrome", description: "List local Chrome profiles" }, args: { "user-data-dir": { type: "string", description: "Chrome user data dir", valueHint: "path" }, output: { type: "string", description: "Output format: text|json", default: "text" } }, async run({ args }) { const a = args as CliArgs; try { const profiles = await listChromeProfiles({ userDataDir: typeof a["user-data-dir"] === "string" ? a["user-data-dir"] : undefined }); print("profile list-chrome", { data: { count: profiles.length, profiles } }, a); } catch (e) { withCliError("profile list-chrome", a, e); } } });
export default defineCommand({ meta: { name: "profile", description: "Browser profile helpers" }, subCommands: { "list-chrome": listChrome } });
