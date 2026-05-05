import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedBootstrapApply } from "#engine/session.js";
import { removeBootstrapInitScript } from "#store/config.js";
import { assertSessionAutomationControl } from "#store/control-state.js";
import { type CliArgs, print, session, str, stringArray, withCliError } from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "bootstrap",
    description:
      "Purpose: apply BrowserContext bootstrap settings to a managed session.\nExamples:\n  pw bootstrap -s task-a --init-script ./init.js\n  pw bootstrap -s task-a --headers-file ./headers.json\nNotes: use this to make a test session deterministic before navigation or action steps.",
  },
  args: {
    ...sharedArgs,
    action: { type: "enum", options: ["apply"], description: "Action", default: "apply" },
    "init-script": { type: "string", description: "Init script file", valueHint: "path" },
    "headers-file": { type: "string", description: "Extra headers JSON", valueHint: "path" },
    "remove-init-script": {
      type: "string",
      description: "Remove saved init script",
      valueHint: "path",
    },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const sessionName = session(a);
      if (str(a["remove-init-script"])) {
        await assertSessionAutomationControl(sessionName, "bootstrap remove-init-script");
        print(
          "bootstrap",
          {
            data: {
              removed: true,
              config: await removeBootstrapInitScript(
                sessionName,
                str(a["remove-init-script"]) as string,
              ),
            },
          },
          a,
        );
        return;
      }
      await assertSessionAutomationControl(sessionName, "bootstrap apply");
      print(
        "bootstrap",
        await managedBootstrapApply({
          sessionName,
          initScripts: stringArray(a["init-script"]),
          headersFile: str(a["headers-file"]),
        }),
        a,
      );
    } catch (e) {
      withCliError("bootstrap", a, e);
    }
  },
});
