import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineCommand } from "citty";
import { managedTrace } from "#engine/diagnose/trace.js";
import { writeChromeProfileConfig } from "#engine/environment.js";
import { managedStateLoad, managedStateSave } from "#engine/identity.js";
import { getManagedSessionEntry, getManagedSessionStatus, listAttachableBrowserServers, listManagedSessions, managedBootstrapApply, managedOpen, parsePageSummary, runManagedSessionCommand, sessionRoutingError, stopAllManagedSessions, stopManagedSession } from "#engine/session.js";
import { getSessionDefaults, readBootstrapConfig, resolveHeaded, resolveTraceEnabled } from "#store/config.js";
import { sharedArgs } from "#cli/args.js";
import { attachManagedSession, resolveAttachTarget } from "#cli/parsers/session.js";
import { bool, firstPos, print, printError, session as requireSession, str, stringArray, type CliArgs } from "./_helpers.js";
import { printCommandError } from "../output.js";

async function getSessionPageSummary(name: string) {
  const result = await runManagedSessionCommand({ _: ["snapshot"] }, { sessionName: name });
  return parsePageSummary(result.text);
}

async function applySessionDefaults(options: { sessionName: string; traceEnabled: boolean }) {
  if (!options.traceEnabled) return { trace: { requested: false, applied: false } };
  try {
    const trace = await managedTrace("start", { sessionName: options.sessionName });
    return { trace: { requested: true, applied: true, data: trace.data } };
  } catch (error) {
    return { trace: { requested: true, applied: false, error: error instanceof Error ? error.message : String(error) } };
  }
}

function sessionError(command: string, a: CliArgs, error: unknown, fallback: string) {
  const routing = sessionRoutingError(error instanceof Error ? error.message : String(error));
  if (routing) printCommandError(command, routing, a.output);
  else printCommandError(command, { code: `${command.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_FAILED`, message: error instanceof Error ? error.message : fallback }, a.output);
  process.exitCode = 1;
}

const list = defineCommand({
  meta: { name: "list", description: "List managed sessions" },
  args: { output: sharedArgs.output, "with-page": { type: "boolean", description: "Include page summaries" }, attachable: { type: "boolean", description: "Include attachable browser servers" } },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const sessions = await listManagedSessions();
      const enriched = bool(a["with-page"]) ? await Promise.all(sessions.map(async (entry) => ({ ...entry, page: entry.alive ? await getSessionPageSummary(entry.name).catch(() => undefined) : undefined }))) : sessions;
      const attachable = bool(a.attachable) ? await listAttachableBrowserServers() : undefined;
      print("session list", { data: { count: enriched.length, withPage: bool(a["with-page"]), sessions: enriched, ...(attachable ? { attachable } : {}) } }, a);
    } catch (e) { sessionError("session list", a, e, "session list failed"); }
  },
});

const create = defineCommand({
  meta: { name: "create", description: "Create a named managed session" },
  args: { output: sharedArgs.output, open: { type: "string", description: "Open URL", valueHint: "url" }, profile: { type: "string", description: "Persistent profile path", valueHint: "path" }, "from-system-chrome": { type: "boolean", description: "Use local Chrome profile" }, "chrome-profile": { type: "string", description: "Chrome profile", valueHint: "name" }, persistent: { type: "boolean", description: "Use persistent profile" }, state: { type: "string", description: "Load storage state", valueHint: "path" }, headed: { type: "boolean", description: "Open headed browser", default: false }, trace: { type: "boolean", description: "Enable trace recording", default: true }, "init-script": { type: "string", description: "Init script file", valueHint: "path" } },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const name = requireSession({ session: firstPos(a) });
      if (str(a.profile) && (bool(a["from-system-chrome"]) || str(a["chrome-profile"]))) throw new Error("session create accepts either --profile or --from-system-chrome, not both");
      const defaults = await getSessionDefaults();
      const headed = await resolveHeaded({ headed: bool(a.headed), headless: !bool(a.headed) });
      const traceEnabled = await resolveTraceEnabled({ trace: a.trace as boolean | undefined });
      const systemChrome = bool(a["from-system-chrome"]) || str(a["chrome-profile"]) ? await writeChromeProfileConfig(name, str(a["chrome-profile"])) : undefined;
      const persistent = bool(a.persistent) || Boolean(str(a.profile)) || Boolean(systemChrome);
      await managedOpen("about:blank", { sessionName: name, headed, profile: str(a.profile), persistent, ...(systemChrome ? { config: systemChrome.configPath } : {}), reset: true });
      if (str(a.state)) await managedStateLoad(str(a.state) as string, { sessionName: name });
      const appliedDefaults = await applySessionDefaults({ sessionName: name, traceEnabled });
      const initScripts = stringArray(a["init-script"]);
      if (initScripts.length) await managedBootstrapApply({ sessionName: name, initScripts });
      const result = await managedOpen(str(a.open) ?? "about:blank", { sessionName: name, reset: false });
      print("session create", { session: result.session, page: result.page, data: { ...result.data, created: true, sessionName: name, defaults, appliedDefaults, headed, traceEnabled, ...(initScripts.length ? { bootstrapApplied: true } : {}), ...(systemChrome ? { systemChromeProfile: systemChrome.profile, config: systemChrome.configPath } : {}), ...(str(a.state) ? { stateLoaded: str(a.state) } : {}) } }, a);
    } catch (e) { sessionError("session create", a, e, "session create failed"); }
  },
});

async function resolveAttachableServer(attachableId: string) {
  const attachable = await listAttachableBrowserServers();
  const server = attachable.servers.find((entry) => entry.id === attachableId || entry.title === attachableId);
  if (!server?.canConnect || !server.endpoint) throw new Error(`attachable server '${attachableId}' not found or not connectable`);
  return { endpoint: server.endpoint, resolvedVia: "attachable-id" as const };
}

const attach = defineCommand({
  meta: { name: "attach", description: "Attach a managed session to an existing browser endpoint" },
  args: { output: sharedArgs.output, "ws-endpoint": { type: "string", description: "Playwright websocket endpoint", valueHint: "url" }, "browser-url": { type: "string", description: "CDP browser URL", valueHint: "url" }, cdp: { type: "string", description: "CDP port", valueHint: "port" }, "attachable-id": { type: "string", description: "Attachable server id", valueHint: "id" }, trace: { type: "boolean", description: "Enable trace recording", default: true } },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const parts = (a._ as string[] | undefined) ?? [];
      const name = requireSession({ session: parts[0] });
      const endpoint = parts[1];
      const defaults = await getSessionDefaults();
      const traceEnabled = await resolveTraceEnabled({ trace: a.trace as boolean | undefined });
      const target = str(a["attachable-id"]) ? await resolveAttachableServer(str(a["attachable-id"]) as string) : await resolveAttachTarget(endpoint, { wsEndpoint: str(a["ws-endpoint"]), browserUrl: str(a["browser-url"]), cdp: str(a.cdp) });
      const result = await attachManagedSession({ sessionName: name, endpoint: target.endpoint, resolvedVia: target.resolvedVia, ...("browserURL" in target ? { browserURL: target.browserURL } : {}) });
      const appliedDefaults = await applySessionDefaults({ sessionName: name, traceEnabled });
      print("session attach", { ...result, data: { ...result.data, defaults, appliedDefaults, traceEnabled } }, a);
    } catch (e) { sessionError("session attach", a, e, "session attach failed"); }
  },
});

const recreate = defineCommand({
  meta: { name: "recreate", description: "Recreate a named managed session" },
  args: { output: sharedArgs.output, headed: { type: "boolean", description: "Open headed browser", default: false }, open: { type: "string", description: "Open URL", valueHint: "url" }, trace: { type: "boolean", description: "Enable trace recording", default: true } },
  async run({ args }) {
    const a = args as CliArgs;
    let tempDir: string | undefined;
    try {
      const name = requireSession({ session: firstPos(a) });
      const entry = await getManagedSessionEntry(name);
      if (!entry) throw new Error(`SESSION_NOT_FOUND:${name}`);
      const currentPage = await getSessionPageSummary(name).catch(() => undefined);
      const currentHeaded = entry.config.browser?.launchOptions?.headless === false;
      const defaults = await getSessionDefaults();
      const headed = a.headed === true ? true : currentHeaded;
      const traceEnabled = await resolveTraceEnabled({ trace: a.trace as boolean | undefined });
      const profile = entry.config.browser?.userDataDir;
      const persistent = Boolean(entry.config.cli?.persistent || profile);
      const targetUrl = str(a.open) ?? currentPage?.url ?? "about:blank";
      tempDir = await mkdtemp(join(tmpdir(), "pwcli-recreate-"));
      const statePath = join(tempDir, "state.json");
      let stateSaved = false;
      try { await managedStateSave(statePath, { sessionName: name }); stateSaved = true; } catch {}
      await stopManagedSession(name);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await managedOpen(stateSaved ? "about:blank" : targetUrl, { sessionName: name, headed, ...(profile ? { profile } : {}), ...(persistent ? { persistent: true } : {}), reset: true, timeoutMs: 30000, timeoutCode: "SESSION_RECREATE_STARTUP_TIMEOUT" });
      if (stateSaved) await managedStateLoad(statePath, { sessionName: name });
      const appliedDefaults = await applySessionDefaults({ sessionName: name, traceEnabled });
      const bootstrapConfig = await readBootstrapConfig(name);
      let bootstrapReapplied = false;
      if (bootstrapConfig && (bootstrapConfig.initScripts.length > 0 || bootstrapConfig.headersFile)) {
        await managedBootstrapApply({ sessionName: name, initScripts: bootstrapConfig.initScripts, headersFile: bootstrapConfig.headersFile });
        bootstrapReapplied = true;
      }
      if (targetUrl !== "about:blank") await managedOpen(targetUrl, { sessionName: name, reset: false });
      const page = await getSessionPageSummary(name).catch(() => undefined);
      print("session recreate", { session: { scope: "managed", name, default: name === "default" }, page, data: { recreated: true, headed, defaults, appliedDefaults, traceEnabled, bootstrapReapplied, ...(profile ? { profile } : {}), ...(persistent ? { persistent: true } : {}), ...(str(a.open) ? { openedUrl: str(a.open) } : {}) } }, a);
    } catch (e) { sessionError("session recreate", a, e, "session recreate failed"); } finally { if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => {}); }
  },
});

const status = defineCommand({ meta: { name: "status", description: "Show session status" }, args: { output: sharedArgs.output }, async run({ args }) { const a = args as CliArgs; try { const name = firstPos(a) as string; const status = await getManagedSessionStatus(name); if (!status) throw new Error(`SESSION_NOT_FOUND:${name}`); print("session status", { session: { scope: "managed", name: status.name, default: status.name === "default" }, data: { active: status.alive, socketPath: status.socketPath, version: status.version, workspaceDir: status.workspaceDir } }, a); } catch (e) { sessionError("session status", a, e, "session status failed"); } } });
const close = defineCommand({ meta: { name: "close", description: "Close one or all sessions" }, args: { output: sharedArgs.output, all: { type: "boolean", description: "Close all sessions" } }, async run({ args }) { const a = args as CliArgs; try { const name = firstPos(a); const closeAll = bool(a.all) || name === "all"; if (closeAll) { const result = await stopAllManagedSessions(); print("session close", { data: { all: true, ...result } }, a); } else { print("session close", { data: { name, closed: await stopManagedSession(name) } }, a); } } catch (e) { sessionError("session close", a, e, "session close failed"); } } });

export default defineCommand({ meta: { name: "session", description: "Manage named browser sessions" }, subCommands: { list, create, attach, recreate, status, close } });
