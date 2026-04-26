import type { Command } from "commander";
import {
  managedRunCode,
} from "../../domain/interaction/service.js";
import { managedOpen } from "../../domain/session/service.js";
import { managedStateLoad, managedStateSave } from "../../domain/identity-state/service.js";
import { resolveDcLoginArgs } from "../../infra/plugins/dc-login-config.js";
import { loadPluginSource, parseKeyValueArgs, resolvePluginPath } from "../../infra/plugins/resolve.js";
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
      .option("--headed", "Launch a visible browser window")
      .option("--profile <path>", "Use a persistent browser profile before auth")
      .option("--persistent", "Use a persistent browser profile before auth")
      .option("--state <file>", "Load storage state before running the auth plugin")
      .option("--save-state <file>", "Save storage state after auth finishes")
      .option("--open <url>", "Navigate to a target page after auth completes")
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
        headed?: boolean;
        profile?: string;
        persistent?: boolean;
        state?: string;
        saveState?: string;
        open?: string;
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
        if (pluginName === "dc-login" && options.open && !rawArgs.targetUrl) {
          rawArgs.targetUrl = options.open;
        }
        const args = pluginName === "dc-login" ? await resolveDcLoginArgs(rawArgs) : rawArgs;
        const persistent = options.persistent || Boolean(options.profile);

        if (options.profile || options.persistent || options.state || options.headed) {
          await managedOpen("about:blank", {
            sessionName,
            headed: options.headed,
            profile: options.profile,
            persistent,
            reset: true,
          });
        }

        if (options.state) {
          await managedStateLoad(options.state, { sessionName });
        }

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

        let finalSession = result.session;
        let finalPage = result.page;
        if (options.open) {
          const openResult = await managedOpen(options.open, {
            sessionName,
            reset: false,
          });
          finalSession = openResult.session;
          finalPage = openResult.page;
        }

        if (options.saveState) {
          await managedStateSave(options.saveState, { sessionName });
        }

        printCommandResult("auth", {
          session: finalSession,
          page: finalPage,
          data: {
            plugin: pluginName,
            pluginPath: path,
            args,
            pageState,
            ...(options.profile ? { profile: options.profile } : {}),
            ...(persistent ? { persistent: true } : {}),
            ...(options.state ? { stateLoaded: options.state } : {}),
            ...(options.open ? { openedUrl: options.open } : {}),
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
            "Use `pw auth <plugin> --profile <dir> --open <url>` to reuse a persistent login flow",
            "Use `pw auth <plugin> --state ./auth.json --open <url>` to reuse a saved authenticated state",
          ],
        });
        process.exitCode = 1;
      }
    },
  );
}
