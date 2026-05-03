import { defineCommand } from "citty";
import { listAuthProviders, getAuthProvider, loadAuthProviderSource, parseKeyValueArgs } from "#auth/registry.js";
import { managedAuthProbe, managedStateSave } from "#engine/identity.js";
import { managedRunCode } from "#engine/shared.js";
import { sharedArgs } from "#cli/args.js";
import { print, printError, session, str, stringArray, withCliError, type CliArgs } from "./_helpers.js";

function buildProviderInvocationSource(providerSource: string, providerArgs: Record<string, string>) {
  return `async page => {
    const provider = (() => {
      return ${providerSource}
    })();
    return await provider(page, ${JSON.stringify(providerArgs)});
  }`;
}

const list = defineCommand({ meta: { name: "list", description: "List built-in auth providers" }, args: sharedArgs, run({ args }) { const a = args as CliArgs; print("auth list", { data: { providers: listAuthProviders() } }, a); } });
const info = defineCommand({ meta: { name: "info", description: "Show provider info" }, args: sharedArgs, run({ args }) { const a = args as CliArgs; const name = String((a._ as string[] | undefined)?.[0] ?? ""); const provider = getAuthProvider(name); if (!provider) { printError("auth info", a, { code: "AUTH_PROVIDER_NOT_FOUND", message: `Auth provider '${name}' not found` }); return; } print("auth info", { data: provider as unknown as Record<string, unknown> }, a); } });
const probe = defineCommand({ meta: { name: "probe", description: "Read-only auth state probe" }, args: { ...sharedArgs, url: { type: "string", description: "Protected URL to probe", valueHint: "url" } }, async run({ args }) { const a = args as CliArgs; try { print("auth probe", await managedAuthProbe({ sessionName: session(a), url: str(a.url) }), a); } catch (e) { withCliError("auth probe", a, e); } } });

function providerCommand(name: string) {
  return defineCommand({ meta: { name, description: `Run auth provider ${name}` }, args: { ...sharedArgs, "save-state": { type: "string", description: "Save storage state after auth", valueHint: "path" }, arg: { type: "string", description: "Provider arg key=value", valueHint: "key=value" } }, async run({ args }) { const a = args as CliArgs; try { const provider = getAuthProvider(name); if (!provider) throw new Error(`AUTH_PROVIDER_NOT_FOUND:${name}`); const rawArgs = parseKeyValueArgs(stringArray(a.arg)); const resolvedArgs = provider.resolveArgs ? await provider.resolveArgs(rawArgs) : rawArgs; const result = await managedRunCode({ sessionName: session(a), source: buildProviderInvocationSource(loadAuthProviderSource(provider), resolvedArgs) }); if (str(a["save-state"])) await managedStateSave(str(a["save-state"]), { sessionName: session(a) }); const providerResult = result.data.result as Record<string, unknown> | undefined; print("auth", { session: result.session, page: result.page, data: { provider: name, ...(typeof providerResult?.resolvedTargetUrl === "string" ? { resolvedTargetUrl: providerResult.resolvedTargetUrl } : {}), ...(typeof providerResult?.resolvedBy === "string" ? { resolvedBy: providerResult.resolvedBy } : {}), pageState: providerResult?.pageState ?? providerResult?.page ?? null, result: providerResult, ...(str(a["save-state"]) ? { stateSaved: str(a["save-state"]) } : {}) } }, a); } catch (e) { withCliError("auth", a, e); } } });
}

const subCommands: Record<string, ReturnType<typeof defineCommand>> = { list, info, probe };
for (const provider of listAuthProviders()) subCommands[provider.name] = providerCommand(provider.name);

export default defineCommand({ meta: { name: "auth", description: "Run built-in auth providers" }, subCommands });
