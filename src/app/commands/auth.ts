import type { Command } from "commander";
import { managedStateSave } from "../../domain/identity-state/service.js";
import { managedRunCode } from "../../domain/interaction/service.js";
import {
  getAuthProvider,
  listAuthProviders,
  loadAuthProviderSource,
  parseKeyValueArgs,
} from "../../infra/auth-providers/registry.js";
import { printCommandError, printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

function buildProviderInvocationSource(
  providerSource: string,
  providerArgs: Record<string, string>,
) {
  return `async page => {
    const provider = (() => {
      return ${providerSource}
    })();
    return await provider(page, ${JSON.stringify(providerArgs)});
  }`;
}

export function registerAuthCommand(program: Command): void {
  const auth = program
    .command("auth")
    .description("Run a built-in auth provider inside a named managed session");
  auth.addHelpText(
    "after",
    [
      "",
      "Examples:",
      "  pw auth list",
      "  pw auth info dc-login",
      "  pw auth dc-login --session dc-forge --arg phone=13800138000 --arg targetUrl='https://developer-192-168-5-18.tap.dev/forge'",
    ].join("\n"),
  );

  auth
    .command("list")
    .description("List built-in auth providers")
    .action(() => {
      const providers = listAuthProviders();
      printCommandResult("auth list", {
        data: {
          count: providers.length,
          providers,
        },
      });
    });

  auth
    .command("info <name>")
    .description("Show built-in auth provider details")
    .action((name: string) => {
      const provider = getAuthProvider(name);
      if (!provider) {
        printCommandError("auth info", {
          code: "AUTH_PROVIDER_NOT_FOUND",
          message: `auth provider '${name}' not found`,
          suggestions: ["Run `pw auth list` to inspect built-in auth providers"],
        });
        process.exitCode = 1;
        return;
      }

      printCommandResult("auth info", {
        data: {
          name: provider.name,
          summary: provider.summary,
          description: provider.description,
          args: provider.args,
          examples: provider.examples,
          ...(provider.notes ? { notes: provider.notes } : {}),
        },
      });
    });

  const authUse = auth.command("use <provider>", { isDefault: true });

  addSessionOption(
    authUse
      .option("--save-state <file>", "Save storage state after auth finishes")
      .option(
        "--arg <key=value>",
        "Provider argument",
        (value, acc) => {
          acc.push(value);
          return acc;
        },
        [] as string[],
      ),
  ).action(
    async (
      provider: string,
      options: {
        session?: string;
        saveState?: string;
        arg?: string[];
      },
    ) => {
      try {
        const sessionName = requireSessionName(options);
        const providerName = provider.trim();

        const providerSpec = getAuthProvider(providerName);
        if (!providerSpec) {
          throw new Error(`auth provider '${providerName}' not found`);
        }

        const providerSource = loadAuthProviderSource(providerSpec);
        const rawArgs = parseKeyValueArgs(options.arg);
        const args = providerSpec.resolveArgs ? await providerSpec.resolveArgs(rawArgs) : rawArgs;

        const result = await managedRunCode({
          sessionName,
          source: buildProviderInvocationSource(providerSource, args),
        });
        const providerResult =
          result.data.result && typeof result.data.result === "object"
            ? (result.data.result as Record<string, unknown>)
            : undefined;
        const pageState =
          providerResult?.pageState && typeof providerResult.pageState === "object"
            ? (providerResult.pageState as Record<string, unknown>)
            : providerResult?.page && typeof providerResult.page === "object"
              ? (providerResult.page as Record<string, unknown>)
              : undefined;

        if (options.saveState) {
          await managedStateSave(options.saveState, { sessionName });
        }

        printCommandResult("auth", {
          session: result.session,
          page: result.page,
          data: {
            provider: providerName,
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
            "Run `pw auth list` to inspect built-in auth providers",
            "Run `pw auth info dc-login` to inspect required args and defaults",
            "Create the session first with `pw session create <name> --open <url>`",
            "Pass provider-specific runtime args through `--arg key=value`",
          ],
        });
        process.exitCode = 1;
      }
    },
  );
}
