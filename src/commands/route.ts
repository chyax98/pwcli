import type { Command } from "commander";
import { managedRoute } from "../core/managed.js";
import { printCommandResult } from "../utils/output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerRouteCommand(program: Command): void {
  const route = program
    .command("route")
    .description("Manage minimal network routes in a named managed session");

  addSessionOption(
    route
      .command("add <pattern>")
      .description("Add a route using the current BrowserContext")
      .option("--abort", "Abort matching requests")
      .option("--body <text>", "Fulfill matching requests with a text body")
      .option("--status <code>", "Fulfill matching requests with an HTTP status")
      .option("--content-type <type>", "Fulfill matching requests with a content-type"),
  ).action(
    async (
      pattern: string,
      options: {
        session?: string;
        abort?: boolean;
        body?: string;
        status?: string;
        contentType?: string;
      },
      command: Command,
    ) => {
      try {
        const sessionName = requireSessionName(options, command);
        printCommandResult(
          "route add",
          await managedRoute("add", {
            sessionName,
            pattern,
            abort: options.abort,
            body: options.body,
            status: options.status ? Number(options.status) : undefined,
            contentType: options.contentType,
          }),
        );
      } catch (error) {
        printSessionAwareCommandError("route add", error, {
          code: "ROUTE_ADD_FAILED",
          message: "route add failed",
          suggestions: [
            "Use `pw route --session bug-a add '**/api/**' --abort`",
            "Or fulfill a mock response with `--body` and optional `--status`",
          ],
        });
        process.exitCode = 1;
      }
    },
  );

  addSessionOption(
    route
      .command("remove [pattern]")
      .description("Remove matching routes, or all routes when pattern is omitted"),
  ).action(async (pattern: string | undefined, options: { session?: string }, command: Command) => {
    try {
      const sessionName = requireSessionName(options, command);
      printCommandResult(
        "route remove",
        await managedRoute("remove", {
          sessionName,
          pattern,
        }),
      );
    } catch (error) {
      printSessionAwareCommandError("route remove", error, {
        code: "ROUTE_REMOVE_FAILED",
        message: "route remove failed",
        suggestions: [
          "Use `pw route --session bug-a remove '**/api/**'` to remove one pattern",
          "Omit the pattern to clear all managed-session routes",
        ],
      });
      process.exitCode = 1;
    }
  });
}
