import type { Command } from "commander";
import { managedCookiesList, managedCookiesSet } from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerCookiesCommand(program: Command): void {
  const cookies = program.command("cookies").description("Inspect or set browser cookies");

  addSessionOption(
    cookies
      .command("list")
      .description("List cookies for the current BrowserContext")
      .option("--domain <domain>", "Filter cookies by domain"),
  ).action(async (options: { session?: string; domain?: string }, command: Command) => {
    try {
      const sessionName = requireSessionName(options, command);
      printCommandResult(
        "cookies list",
        await managedCookiesList({
          sessionName,
          domain: options.domain,
        }),
      );
    } catch (error) {
      printSessionAwareCommandError("cookies list", error, {
        code: "COOKIES_LIST_FAILED",
        message: "cookies list failed",
        suggestions: ["Run `pw session create <name> --open <url>` first"],
      });
      process.exitCode = 1;
    }
  });

  addSessionOption(
    cookies
      .command("set")
      .description("Set a cookie on the current BrowserContext")
      .requiredOption("--name <name>", "Cookie name")
      .requiredOption("--value <value>", "Cookie value")
      .requiredOption("--domain <domain>", "Cookie domain")
      .option("--path <path>", "Cookie path", "/"),
  ).action(
    async (
      options: {
        session?: string;
        name: string;
        value: string;
        domain: string;
        path?: string;
      },
      command: Command,
    ) => {
      try {
        const sessionName = requireSessionName(options, command);
        printCommandResult(
          "cookies set",
          await managedCookiesSet({
            sessionName,
            name: options.name,
            value: options.value,
            domain: options.domain,
            path: options.path,
          }),
        );
      } catch (error) {
        printSessionAwareCommandError("cookies set", error, {
          code: "COOKIES_SET_FAILED",
          message: "cookies set failed",
          suggestions: [
            "Pass --name, --value, and --domain",
            "Use a live session with the target site already open when possible",
          ],
        });
        process.exitCode = 1;
      }
    },
  );
}
