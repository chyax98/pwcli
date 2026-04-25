import type { Command } from "commander";
import { managedRunCode } from "../core/managed.js";
import { loadPluginSource, parseKeyValueArgs, resolvePluginPath } from "../plugins/resolve.js";
import { printCommandError, printCommandResult } from "../utils/output.js";

function buildPluginInvocationSource(pluginSource: string, pluginArgs: Record<string, string>) {
  return `async page => {
    const plugin = (() => {
      return ${pluginSource}
    })();
    return await plugin(page, ${JSON.stringify(pluginArgs)});
  }`;
}

export function registerAuthCommand(program: Command): void {
  program
    .command("auth [plugin]")
    .description("Run a local auth plugin inside the default managed session")
    .option("--plugin <name>", "Plugin name or file path")
    .option(
      "--arg <key=value>",
      "Plugin argument",
      (value, acc) => {
        acc.push(value);
        return acc;
      },
      [] as string[],
    )
    .action(async (plugin: string | undefined, options: { plugin?: string; arg?: string[] }) => {
      try {
        const pluginName = options.plugin ?? plugin;
        if (!pluginName) {
          throw new Error("auth requires a plugin name or --plugin <name>");
        }

        const path = resolvePluginPath(pluginName);
        if (!path) {
          throw new Error(`plugin '${pluginName}' not found`);
        }

        const pluginSource = loadPluginSource(path);
        const args = parseKeyValueArgs(options.arg);
        const result = await managedRunCode({
          source: buildPluginInvocationSource(pluginSource, args),
        });
        const pluginResult =
          result.data.result && typeof result.data.result === "object"
            ? (result.data.result as Record<string, unknown>)
            : undefined;
        const pageState =
          pluginResult?.pageState && typeof pluginResult.pageState === "object"
            ? (pluginResult.pageState as Record<string, unknown>)
            : pluginResult?.page && typeof pluginResult.page === "object"
              ? (pluginResult.page as Record<string, unknown>)
              : undefined;

        printCommandResult("auth", {
          session: result.session,
          page: result.page,
          data: {
            plugin: pluginName,
            pluginPath: path,
            args,
            pageState,
            result: result.data.result,
            ...(result.data.resultText ? { resultText: result.data.resultText } : {}),
          },
        });
      } catch (error) {
        printCommandError("auth", {
          code: "AUTH_FAILED",
          message: error instanceof Error ? error.message : "auth failed",
          suggestions: [
            "Create plugins/<name>.js or ~/.pwcli/plugins/<name>.js",
            "Export a function like: async (page, args) => { ... }",
          ],
        });
        process.exitCode = 1;
      }
    });
}
