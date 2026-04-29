import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import { printCommandError, printCommandResult } from "../output.js";

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

      const child = spawn(process.execPath, [paths.entrypoint, "cli", "show"], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();

      printCommandResult("dashboard open", {
        data: {
          command: "playwright cli show",
          dashboardApp: paths.dashboardApp,
          entrypoint: paths.entrypoint,
          launched: true,
        },
      });
    });
}
