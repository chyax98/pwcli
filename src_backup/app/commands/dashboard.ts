import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import { printCommandError, printCommandResult } from "../output.js";

const DASHBOARD_LAUNCH_OBSERVE_MS = 1_000;

type DashboardLaunchFailure =
  | { error: Error; phase: "spawn" }
  | { code: number | null; phase: "early-exit"; signal: NodeJS.Signals | null };

function packageRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
}

function playwrightDashboardPaths() {
  const root = packageRoot();
  return {
    dashboardApp: resolve(
      root,
      "node_modules",
      "playwright-core",
      "lib",
      "tools",
      "dashboard",
      "dashboardApp.js",
    ),
    entrypoint: resolve(root, "node_modules", "playwright-core", "cli.js"),
  };
}

export function observeDashboardLaunch(
  child: ChildProcess,
  observeMs = DASHBOARD_LAUNCH_OBSERVE_MS,
): Promise<DashboardLaunchFailure | null> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onError = (error: Error) => {
      finish({ error, phase: "spawn" });
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      finish({ code, phase: "early-exit", signal });
    };
    const finish = (result: DashboardLaunchFailure | null) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      child.off("error", onError);
      child.off("exit", onExit);
      resolve(result);
    };

    timer = setTimeout(() => finish(null), observeMs);
    child.once("error", onError);
    child.once("exit", onExit);
  });
}

export function registerDashboardCommand(program: Command): void {
  const dashboard = program
    .command("dashboard")
    .description("Open Playwright's bundled session dashboard");

  dashboard
    .command("open")
    .description("Open the Playwright session dashboard for human observation")
    .option("--dry-run", "Validate the Playwright dashboard entrypoint without launching it")
    .action(async (options: { dryRun?: boolean }) => {
      const paths = playwrightDashboardPaths();
      const entrypointAvailable = existsSync(paths.entrypoint);
      const dashboardAppAvailable = existsSync(paths.dashboardApp);
      if (!entrypointAvailable || !dashboardAppAvailable) {
        printCommandError("dashboard open", {
          code: "DASHBOARD_UNAVAILABLE",
          message:
            "Playwright dashboard entrypoint is unavailable in the installed playwright-core package",
          details: {
            dashboardApp: paths.dashboardApp,
            dashboardAppAvailable,
            entrypoint: paths.entrypoint,
            entrypointAvailable,
          },
          retryable: false,
          suggestions: [
            "Run `pnpm install`",
            "Use `pw session list --with-page` for a CLI-only session overview",
          ],
        });
        process.exitCode = 1;
        return;
      }

      if (options.dryRun) {
        printCommandResult("dashboard open", {
          data: {
            available: true,
            dashboardApp: paths.dashboardApp,
            entrypoint: paths.entrypoint,
            launched: false,
          },
        });
        return;
      }

      // Spawn dashboardApp.js directly instead of going through cli.js cli show.
      // cli.js spawns dashboardApp.js as a detached child and exits immediately,
      // so observeDashboardLaunch would always see an early exit and report failure.
      const child = spawn(process.execPath, [paths.dashboardApp], {
        detached: true,
        stdio: "ignore",
      });
      const launchFailure = await observeDashboardLaunch(child);
      if (launchFailure) {
        // exitCode=0: acquireSingleton() found an existing instance, sent bringToFront, exited cleanly
        if (launchFailure.phase === "early-exit" && launchFailure.code === 0) {
          printCommandResult("dashboard open", {
            data: {
              command: "dashboardApp.js",
              dashboardApp: paths.dashboardApp,
              launched: true,
              alreadyRunning: true,
            },
          });
          return;
        }
        printCommandError("dashboard open", {
          code: "DASHBOARD_LAUNCH_FAILED",
          message: "Playwright dashboard subprocess failed during startup",
          details: {
            command: "dashboardApp.js",
            dashboardApp: paths.dashboardApp,
            observeMs: DASHBOARD_LAUNCH_OBSERVE_MS,
            phase: launchFailure.phase,
            ...(launchFailure.phase === "spawn"
              ? { errorMessage: launchFailure.error.message }
              : { exitCode: launchFailure.code, signal: launchFailure.signal }),
          },
          retryable: false,
          suggestions: [
            "Run `pw dashboard open --dry-run` to validate the bundled Playwright dashboard entrypoint",
            "Use `pw session list --with-page` for a CLI-only session overview",
          ],
        });
        process.exitCode = 1;
        return;
      }
      child.unref();

      printCommandResult("dashboard open", {
        data: {
          command: "dashboardApp.js",
          dashboardApp: paths.dashboardApp,
          launched: true,
        },
      });
    });
}
