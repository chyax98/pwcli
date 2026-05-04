import { defineCommand } from "citty";
import type { AuthProviderSpec } from "#auth/registry.js";
import {
  getAuthProvider,
  listAuthProviders,
  loadAuthProviderSource,
  parseKeyValueArgs,
} from "#auth/registry.js";
import { sharedArgs } from "#cli/args.js";
import { managedAuthProbe, managedStateSave } from "#engine/identity.js";
import { managedRunCode } from "#engine/shared.js";
import {
  bool,
  type CliArgs,
  print,
  printError,
  session,
  str,
  stringArray,
  withCliError,
} from "./_helpers.js";

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

function providerInfo(provider: AuthProviderSpec, options: { verbose?: boolean }) {
  const { source, ...safeProvider } = provider;
  return {
    ...safeProvider,
    ...(options.verbose && typeof source === "string" ? { source } : {}),
  };
}

function providerHelpDescription(provider: AuthProviderSpec) {
  const args = provider.args
    .map((arg) => {
      const required = arg.required ? " required" : "";
      const fallback = arg.defaultValue ? ` default=${arg.defaultValue}` : "";
      return `  --arg ${arg.name}=...${required}${fallback} - ${arg.description}`;
    })
    .join("\n");
  const examples = provider.examples.map((example) => `  ${example}`).join("\n");
  const notes = (provider.notes ?? []).map((note) => `  ${note}`).join("\n");
  return [
    `Purpose: ${provider.summary}`,
    "Options: provider params use repeated --arg key=value.",
    args ? `Provider args:\n${args}` : "",
    examples ? `Examples:\n${examples}` : "",
    notes
      ? `Notes:\n${notes}`
      : "Notes: auth runs inside an existing session and does not create sessions.",
  ]
    .filter(Boolean)
    .join("\n");
}

const list = defineCommand({
  meta: { name: "list", description: "List built-in auth providers" },
  args: sharedArgs,
  run({ args }) {
    const a = args as CliArgs;
    print("auth list", { data: { providers: listAuthProviders() } }, a);
  },
});
const info = defineCommand({
  meta: { name: "info", description: "Show provider args, examples and notes" },
  args: { ...sharedArgs, verbose: { type: "boolean", description: "Include provider source" } },
  run({ args }) {
    const a = args as CliArgs;
    const name = String((a._ as string[] | undefined)?.[0] ?? "");
    const provider = getAuthProvider(name);
    if (!provider) {
      printError("auth info", a, {
        code: "AUTH_PROVIDER_NOT_FOUND",
        message: `Auth provider '${name}' not found`,
      });
      return;
    }
    print(
      "auth info",
      {
        data: providerInfo(provider, { verbose: bool(a.verbose) }) as unknown as Record<
          string,
          unknown
        >,
      },
      a,
    );
  },
});
const probe = defineCommand({
  meta: { name: "probe", description: "Read-only auth state probe" },
  args: {
    ...sharedArgs,
    url: { type: "string", description: "Protected URL to probe", valueHint: "url" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print("auth probe", await managedAuthProbe({ sessionName: session(a), url: str(a.url) }), a);
    } catch (e) {
      withCliError("auth probe", a, e);
    }
  },
});

function providerCommand(name: string) {
  const provider = getAuthProvider(name);
  return defineCommand({
    meta: {
      name,
      description: provider ? providerHelpDescription(provider) : `Run auth provider ${name}`,
    },
    args: {
      ...sharedArgs,
      "save-state": {
        type: "string",
        description: "Save storage state after auth",
        valueHint: "path",
      },
      arg: {
        type: "string",
        description: "Provider arg key=value. Repeat for targetUrl, phone, smsCode, baseURL, etc.",
        valueHint: "key=value",
      },
    },
    async run({ args }) {
      const a = args as CliArgs;
      try {
        const provider = getAuthProvider(name);
        if (!provider) throw new Error(`AUTH_PROVIDER_NOT_FOUND:${name}`);
        const rawArgs = parseKeyValueArgs(stringArray(a.arg));
        const resolvedArgs = provider.resolveArgs ? await provider.resolveArgs(rawArgs) : rawArgs;
        const result = await managedRunCode({
          sessionName: session(a),
          source: buildProviderInvocationSource(loadAuthProviderSource(provider), resolvedArgs),
        });
        if (str(a["save-state"]))
          await managedStateSave(str(a["save-state"]), { sessionName: session(a) });
        const providerResult = result.data.result as Record<string, unknown> | undefined;
        print(
          "auth",
          {
            session: result.session,
            page: result.page,
            data: {
              provider: name,
              ...(typeof providerResult?.resolvedTargetUrl === "string"
                ? { resolvedTargetUrl: providerResult.resolvedTargetUrl }
                : {}),
              ...(typeof providerResult?.resolvedBy === "string"
                ? { resolvedBy: providerResult.resolvedBy }
                : {}),
              pageState: providerResult?.pageState ?? providerResult?.page ?? null,
              result: providerResult,
              ...(str(a["save-state"]) ? { stateSaved: str(a["save-state"]) } : {}),
            },
          },
          a,
        );
      } catch (e) {
        withCliError("auth", a, e);
      }
    },
  });
}

const subCommands: Record<string, ReturnType<typeof defineCommand>> = { list, info, probe };
for (const provider of listAuthProviders())
  subCommands[provider.name] = providerCommand(provider.name);

export default defineCommand({
  meta: { name: "auth", description: "Run built-in auth providers" },
  subCommands,
});
