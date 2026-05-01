import type { Command } from "commander";
import { managedAuthProbe, managedStateSave, managedRunCode } from "../../infra/playwright/runtime.js";
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

function formatProviderHelp(provider: NonNullable<ReturnType<typeof getAuthProvider>>) {
  const lines = ["", `Provider: ${provider.name}`, "", provider.description, ""];
  if (provider.args.length > 0) {
    lines.push("Args:");
    for (const arg of provider.args) {
      lines.push(
        `  - ${arg.name}${arg.required ? " (required)" : ""}${arg.defaultValue ? ` [default=${arg.defaultValue}]` : ""}: ${arg.description}`,
      );
    }
    lines.push("");
  }
  if (provider.examples.length > 0) {
    lines.push("Examples:");
    for (const example of provider.examples) {
      lines.push(`  ${example}`);
    }
    lines.push("");
  }
  if (provider.notes?.length) {
    lines.push("Notes:");
    for (const note of provider.notes) {
      lines.push(`  - ${note}`);
    }
  }
  return lines.join("\n").trimEnd();
}

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
      "  pw auth info dc",
      "  pw auth probe --session dc2",
      "  pw auth dc --session dc2",
      "  pw auth dc --session dc2 --arg targetUrl='https://developer-192-168-5-18.tap.dev/forge'",
    ].join("\n"),
  );
  auth.action(() => {
    printCommandError("auth", {
      code: "AUTH_PROVIDER_REQUIRED",
      message: "auth requires a provider name or a discovery subcommand",
      suggestions: [
        "Run `pw auth list` to inspect built-in auth providers",
        "Run `pw auth info dc` to inspect provider args and defaults",
      ],
    });
    process.exitCode = 1;
  });

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

  addSessionOption(
    auth
      .command("probe")
      .description("Read-only auth state probe for the current managed session"),
  )
    .option("--url <target>", "Optionally navigate read-only to a protected URL before probing")
    .action(async (options: { session?: string; url?: string }, command: Command) => {
      try {
        const sessionName = requireSessionName(options, command);
        printCommandResult(
          "auth probe",
          await managedAuthProbe({
            sessionName,
            url: options.url,
          }),
        );
      } catch (error) {
        printSessionAwareCommandError("auth probe", error, {
          code: "AUTH_PROBE_FAILED",
          message: "auth probe failed",
          suggestions: [
            "Create the session first with `pw session create <name> --open <url>`",
            "Open the target site before probing auth state, or pass `--url <protected-url>` for a read-only navigation probe",
            "Use `pw page current --session <name>` and `pw storage local --session <name>` to inspect the current page state",
          ],
        });
        process.exitCode = 1;
      }
    });

  for (const provider of listAuthProviders()
    .map((item) => getAuthProvider(item.name))
    .filter(Boolean)) {
    addSessionOption(
      auth
        .command(provider.name)
        .description(provider.summary)
        .addHelpText("after", formatProviderHelp(provider))
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
    ).action(async (options: { session?: string; saveState?: string; arg?: string[] }) => {
      try {
        const sessionName = requireSessionName(options);
        const providerSource = loadAuthProviderSource(provider);
        const rawArgs = parseKeyValueArgs(options.arg);
        const args = provider.resolveArgs ? await provider.resolveArgs(rawArgs) : rawArgs;

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
        const resolvedTargetUrl =
          typeof providerResult?.resolvedTargetUrl === "string"
            ? providerResult.resolvedTargetUrl
            : undefined;
        const resolvedBy =
          typeof providerResult?.resolvedBy === "string" ? providerResult.resolvedBy : undefined;

        if (options.saveState) {
          await managedStateSave(options.saveState, { sessionName });
        }

        printCommandResult("auth", {
          session: result.session,
          page: result.page,
          data: {
            provider: provider.name,
            ...(resolvedTargetUrl ? { resolvedTargetUrl } : {}),
            ...(resolvedBy ? { resolvedBy } : {}),
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
            `Run \`pw auth info ${provider.name}\` to inspect required args and defaults`,
            "Create the session first with `pw session create <name> --open <url>`",
            "Pass provider-specific runtime args through `--arg key=value`",
          ],
        });
        process.exitCode = 1;
      }
    });
  }
}
