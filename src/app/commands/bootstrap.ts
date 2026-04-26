import type { Command } from "commander";
import { managedBootstrapApply } from "../../domain/bootstrap/service.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerBootstrapCommand(program: Command): void {
  addSessionOption(
    program
      .command("bootstrap <action>")
      .description("Apply live bootstrap steps to an existing named managed session")
      .option(
        "--init-script <file>",
        "Add an init script to the BrowserContext for future navigations",
        (value, acc: string[]) => {
          acc.push(value);
          return acc;
        },
        [] as string[],
      )
      .option("--headers-file <file>", "JSON file of extra HTTP headers to apply"),
  ).action(
    async (
      action: string,
      options: {
        session?: string;
        initScript?: string[];
        headersFile?: string;
      },
    ) => {
      try {
        const sessionName = requireSessionName(options);
        if (action !== "apply") {
          throw new Error("bootstrap currently supports apply only");
        }
        printCommandResult(
          "bootstrap",
          await managedBootstrapApply({
            sessionName,
            initScripts: options.initScript,
            headersFile: options.headersFile,
          }),
        );
      } catch (error) {
        printSessionAwareCommandError("bootstrap", error, {
          code: "BOOTSTRAP_FAILED",
          message: "bootstrap failed",
          suggestions: [
            "Use `pw bootstrap --session bug-a apply --init-script ./scripts/manual/bootstrap-fixture.js`",
            "Use `--headers-file` with a JSON object like {\"x-foo\":\"bar\"}",
          ],
        });
        process.exitCode = 1;
      }
    },
  );
}
