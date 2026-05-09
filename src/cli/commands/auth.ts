import { defineCommand } from "citty";
import type { AuthProviderSpec } from "#auth/registry.js";
import {
  getAuthProvider,
  listAuthProviders,
  loadAuthProviderSource,
  parseKeyValueArgs,
} from "#auth/registry.js";
import { sharedArgs } from "#cli/args.js";
import { managedAuthProbe, managedStateLoad, managedStateSave } from "#engine/identity.js";
import { managedRunCode } from "#engine/shared.js";
import { assertActionAllowed } from "#store/action-policy.js";
import { loadAuthCache, saveAuthCache } from "#store/auth-cache.js";
import { assertSessionAutomationControl } from "#store/control-state.js";
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
  meta: {
    name: "list",
    description:
      "Purpose: list built-in auth providers.\nExamples:\n  pw auth list\nNotes: use `pw auth info <provider>` before running a provider.",
  },
  args: sharedArgs,
  run({ args }) {
    const a = args as CliArgs;
    print("auth list", { data: { providers: listAuthProviders() } }, a);
  },
});
const info = defineCommand({
  meta: {
    name: "info",
    description:
      "Purpose: show provider args, examples and notes.\nExamples:\n  pw auth info dc\n  pw auth info dc --verbose\nNotes: verbose includes provider source for maintainers.",
  },
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
  meta: {
    name: "probe",
    description:
      "Purpose: run a read-only auth state probe for the current session.\nExamples:\n  pw auth probe -s task-a\n  pw auth probe -s task-a --url http://localhost:7778/dashboard\nNotes: use this after login before assuming auth succeeded.",
  },
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
      cache: {
        type: "boolean",
        default: true,
        description: "Use auth cache (default true). Pass --no-cache to disable.",
      },
    },
    async run({ args }) {
      const a = args as CliArgs;
      try {
        const provider = getAuthProvider(name);
        if (!provider) throw new Error(`AUTH_PROVIDER_NOT_FOUND:${name}`);
        const rawArgs = parseKeyValueArgs(stringArray(a.arg));
        const resolvedArgs = provider.resolveArgs ? await provider.resolveArgs(rawArgs) : rawArgs;
        const sessionName = session(a);
        await assertActionAllowed("auth", `auth ${name}`);
        await assertSessionAutomationControl(sessionName, `auth ${name}`);

        const probeUrl = resolvedArgs.targetUrl || resolvedArgs.baseURL;
        if (probeUrl) {
          const probeResult = await managedRunCode({
            sessionName,
            source: `async page => {
              await page.goto(${JSON.stringify(probeUrl)});
              await page.waitForLoadState("networkidle").catch(() => {});
              await page.waitForTimeout(2000);
              const url = page.url();
              const title = await page.title().catch(() => "");
              return { url, title, isLoginPage: url.includes("/login") || title.includes("登录") || title.toLowerCase().includes("login") };
            }`,
          });
          const probe = probeResult.data.result as Record<string, unknown> | undefined;
          if (probe && !probe.isLoginPage) {
            print(
              "auth",
              {
                data: { provider: name, skipped: "already-authenticated", ...probe },
              },
              a,
            );
            return;
          }
        }
        if (bool(a.cache) && resolvedArgs.baseURL) {
          const cacheArgs: Record<string, string> =
            name === "dc" || name === "admin-v3"
              ? { baseURL: resolvedArgs.baseURL, phone: resolvedArgs.phone || "" }
              : { baseURL: resolvedArgs.baseURL };
          const cache = await loadAuthCache(name, cacheArgs);
          if (cache.found) {
            await managedStateLoad(cache.path, { sessionName });
            if (probeUrl) {
              // 先导航到目标页让自动跳转完成，再检查是否已登录
              const navResult = await managedRunCode({
                sessionName,
                source: `async page => {
                  await page.goto(${JSON.stringify(probeUrl)});
                  await page.waitForLoadState("networkidle").catch(() => {});
                  const url = page.url();
                  const title = await page.title().catch(() => "");
                  return { url, title, isLoginPage: url.includes("/login") || title.includes("登录") || title.toLowerCase().includes("login") };
                }`,
              });
              const result = navResult.data.result as Record<string, unknown> | undefined;
              if (result && !result.isLoginPage) {
                print(
                  "auth",
                  {
                    data: { provider: name, fromCache: true, ...result },
                  },
                  a,
                );
                return;
              }
            }
          }
        }

        const result = await managedRunCode({
          sessionName,
          source: buildProviderInvocationSource(loadAuthProviderSource(provider), resolvedArgs),
        });

        if (bool(a.cache) && resolvedArgs.baseURL) {
          try {
            const stateResult = await managedRunCode({
              sessionName,
              source: `async page => { return await page.context().storageState(); }`,
            });
            if (stateResult.data.result) {
              const cacheArgs: Record<string, string> =
                name === "dc" || name === "admin-v3"
                  ? { baseURL: resolvedArgs.baseURL, phone: resolvedArgs.phone || "" }
                  : { baseURL: resolvedArgs.baseURL };
              await saveAuthCache(name, cacheArgs, stateResult.data.result);
            }
          } catch {
            // cache save failure is non-fatal
          }
        }

        if (str(a["save-state"])) await managedStateSave(str(a["save-state"]), { sessionName });
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
