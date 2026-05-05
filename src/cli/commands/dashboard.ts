import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { defineCommand } from "citty";
import { bool, type CliArgs, print, printError } from "./_helpers.js";

const require = createRequire(import.meta.url);
const DASHBOARD_LAUNCH_OBSERVE_MS = 1000;

type DashboardLaunchFailure =
  | { error: Error; phase: "spawn" }
  | { code: number | null; phase: "early-exit"; signal: NodeJS.Signals | null };

function playwrightDashboardPaths() {
  const root = dirname(require.resolve("playwright-core/package.json"));
  return {
    dashboardApp: resolve(root, "lib", "tools", "dashboard", "dashboardApp.js"),
    entrypoint: resolve(root, "cli.js"),
  };
}

export function observeDashboardLaunch(
  child: ChildProcess,
): Promise<DashboardLaunchFailure | null> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: DashboardLaunchFailure | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      child.off("error", onError);
      child.off("exit", onExit);
      resolve(result);
    };
    const onError = (error: Error) => finish({ error, phase: "spawn" });
    const onExit = (code: number | null, signal: NodeJS.Signals | null) =>
      finish({ code, phase: "early-exit", signal });
    timer = setTimeout(() => finish(null), DASHBOARD_LAUNCH_OBSERVE_MS);
    child.once("error", onError);
    child.once("exit", onExit);
  });
}

const open = defineCommand({
  meta: {
    name: "open",
    description:
      "Purpose: open Playwright's bundled session dashboard.\nExamples:\n  pw dashboard open\n  pw dashboard open --dry-run\nNotes: this is a human observation escape hatch and depends on the installed playwright-core package.",
  },
  args: {
    output: { type: "string", description: "Output format: text|json", default: "text" },
    "dry-run": { type: "boolean", description: "Validate without launching" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    const paths = playwrightDashboardPaths();
    const entrypointAvailable = existsSync(paths.entrypoint);
    const dashboardAppAvailable = existsSync(paths.dashboardApp);
    if (!entrypointAvailable || !dashboardAppAvailable) {
      printError("dashboard open", a, {
        code: "DASHBOARD_UNAVAILABLE",
        message:
          "Playwright dashboard entrypoint is unavailable in the installed playwright-core package",
        details: { ...paths, entrypointAvailable, dashboardAppAvailable },
        suggestions: [
          "Run `pnpm install`",
          "Use `pw session list --with-page` for a CLI-only session overview",
        ],
      });
      return;
    }
    if (bool(a["dry-run"])) {
      print("dashboard open", { data: { available: true, ...paths, launched: false } }, a);
      return;
    }
    const child = spawn(process.execPath, [paths.dashboardApp], {
      detached: true,
      stdio: "ignore",
    });
    const failure = await observeDashboardLaunch(child);
    if (failure && !(failure.phase === "early-exit" && failure.code === 0)) {
      printError("dashboard open", a, {
        code: "DASHBOARD_LAUNCH_FAILED",
        message: "Playwright dashboard subprocess failed during startup",
        details:
          failure.phase === "spawn"
            ? { errorMessage: failure.error.message }
            : { exitCode: failure.code, signal: failure.signal },
      });
      return;
    }
    child.unref();
    print(
      "dashboard open",
      {
        data: {
          command: "dashboardApp.js",
          dashboardApp: paths.dashboardApp,
          launched: true,
          alreadyRunning: failure?.phase === "early-exit",
        },
      },
      a,
    );
  },
});

export default defineCommand({
  meta: {
    name: "dashboard",
    description:
      "Purpose: open Playwright's bundled session dashboard when available.\nExamples:\n  pw dashboard open\n  pw dashboard open --dry-run\nNotes: this is a human observation escape hatch; Agent workflows should prefer CLI facts and diagnostics.",
  },
  subCommands: { open },
});
