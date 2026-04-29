import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";
import { printCommandError, printCommandResult } from "../output.js";

function playwrightCliPath() {
  return resolve("node_modules", "playwright-core", "cli.js");
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
      const cli = playwrightCliPath();
      if (!existsSync(cli)) {
        printCommandError("dashboard open", {
          code: "DASHBOARD_UNAVAILABLE",
          message:
            "Playwright dashboard entrypoint is unavailable in the installed playwright-core package",
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
          data: { available: true, entrypoint: cli, launched: false },
        });
        return;
      }

      const child = spawn(process.execPath, [cli, "cli", "show"], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();

      printCommandResult("dashboard open", {
        data: { launched: true, entrypoint: cli, command: "playwright cli show" },
      });
    });
}
