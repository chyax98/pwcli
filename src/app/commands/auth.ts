import type { Command } from "commander";
import { managedStateSave } from "../../domain/identity-state/service.js";
import { managedRunCode } from "../../domain/interaction/service.js";
import { resolveDcLoginArgs } from "../../infra/plugins/dc-login-config.js";
import {
  loadPluginSource,
  parseKeyValueArgs,
  resolvePluginPath,
} from "../../infra/plugins/resolve.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

function buildPluginInvocationSource(pluginSource: string, pluginArgs: Record<string, string>) {
  return `async page => {
    const plugin = (() => {
      return ${pluginSource}
    })();
    return await plugin(page, ${JSON.stringify(pluginArgs)});
  }`;
}

export function registerAuthCommand(program: Command): void {
  addSessionOption(
    program
      .command("auth [plugin]")
      .description("Run a local auth plugin inside a named managed session")
      .option("--plugin <name>", "Plugin name or file path")
      .option("--save-state <file>", "Save storage state after auth finishes")
      .option(
        "--arg <key=value>",
        "Plugin argument",
        (value, acc) => {
          acc.push(value);
          return acc;
        },
        [] as string[],
      ),
  ).action(
    async (
      plugin: string | undefined,
      options: {
        session?: string;
        plugin?: string;
        saveState?: string;
        arg?: string[];
      },
    ) => {
      const sessionName = requireSessionName(options);
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
        const rawArgs = parseKeyValueArgs(options.arg);
        const args = pluginName === "dc-login" ? await resolveDcLoginArgs(rawArgs) : rawArgs;

        const result = await managedRunCode({
          sessionName,
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

        if (options.saveState) {
          await managedStateSave(options.saveState, { sessionName });
        }

        printCommandResult("auth", {
          session: result.session,
          page: result.page,
          data: {
            plugin: pluginName,
            pluginPath: path,
            args,
            pageState,
            ...(options.saveState ? { stateSaved: options.saveState } : {}),
            result: result.data.result,
            ...(result.data.resultText ? { resultText: result.data.resultText } : {}),
          },
        });
      } catch (error) {
        printSessionAwareCommandError("auth", error, {
          code: "AUTH_FAILED",
          message: "auth failed",
          suggestions: [
            "Create plugins/<name>.js or ~/.pwcli/plugins/<name>.js",
            "Export a function like: async (page, args) => { ... }",
            "Create the session first with `pw session create <name> --open <url>`",
            "Pass plugin-specific targets through `--arg key=value`",
          ],
        });
        process.exitCode = 1;
      }
    },
  );
}
