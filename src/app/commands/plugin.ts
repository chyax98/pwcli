import type { Command } from "commander";
import { listPluginNames, resolvePluginPath } from "../../infra/plugins/resolve.js";
import { printCommandError, printCommandResult } from "../output.js";

export function registerPluginCommand(program: Command): void {
  const plugin = program.command("plugin").description("Inspect local pwcli plugins");

  plugin
    .command("list")
    .description("List discovered local plugins")
    .action(() => {
      const plugins = listPluginNames();
      printCommandResult("plugin list", {
        data: {
          count: plugins.length,
          plugins,
        },
      });
    });

  plugin
    .command("path <name>")
    .description("Show resolved local plugin path")
    .action((name: string) => {
      const path = resolvePluginPath(name);
      if (!path) {
        printCommandError("plugin path", {
          code: "PLUGIN_NOT_FOUND",
          message: `plugin '${name}' not found`,
          suggestions: ["Create plugins/<name>.js or ~/.pwcli/plugins/<name>.js"],
        });
        process.exitCode = 1;
        return;
      }

      printCommandResult("plugin path", {
        data: {
          name,
          path,
        },
      });
    });
}
