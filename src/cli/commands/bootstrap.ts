import { defineCommand } from "citty";
import { managedBootstrapApply } from "#engine/session.js";
import { removeBootstrapInitScript } from "#store/config.js";
import { sharedArgs } from "#cli/args.js";
import { print, session, str, stringArray, withCliError, type CliArgs } from "./_helpers.js";

export default defineCommand({
  meta: { name: "bootstrap", description: "Apply BrowserContext bootstrap settings" },
  args: { ...sharedArgs, action: { type: "enum", options: ["apply"], description: "Action", default: "apply" }, "init-script": { type: "string", description: "Init script file", valueHint: "path" }, "headers-file": { type: "string", description: "Extra headers JSON", valueHint: "path" }, "remove-init-script": { type: "string", description: "Remove saved init script", valueHint: "path" } },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const sessionName = session(a);
      if (str(a["remove-init-script"])) {
        print("bootstrap", { data: { removed: true, config: await removeBootstrapInitScript(sessionName, str(a["remove-init-script"]) as string) } }, a);
        return;
      }
      print("bootstrap", await managedBootstrapApply({ sessionName, initScripts: stringArray(a["init-script"]), headersFile: str(a["headers-file"]) }), a);
    } catch (e) { withCliError("bootstrap", a, e); }
  },
});
