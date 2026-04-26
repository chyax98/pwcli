import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Command } from "commander";
import { managedRoute } from "../../domain/diagnostics/service.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerRouteCommand(program: Command): void {
  const route = program
    .command("route")
    .description("Manage minimal network routes in a named managed session");

  addSessionOption(route.command("list").description("List active managed-session routes")).action(
    async (options: { session?: string }, command: Command) => {
      try {
        const sessionName = requireSessionName(options, command);
        printCommandResult(
          "route list",
          await managedRoute("list", {
            sessionName,
          }),
        );
      } catch (error) {
        printSessionAwareCommandError("route list", error, {
          code: "ROUTE_LIST_FAILED",
          message: "route list failed",
        });
        process.exitCode = 1;
      }
    },
  );

  addSessionOption(
    route
      .command("add <pattern>")
      .description("Add a route using the current BrowserContext")
      .option("--abort", "Abort matching requests")
      .option("--body <text>", "Fulfill matching requests with a text body")
      .option("--body-file <path>", "Fulfill matching requests with body loaded from a file")
      .option(
        "--headers-file <path>",
        "Fulfill matching requests with headers loaded from a JSON file",
      )
      .option("--method <method>", "Only match one HTTP method")
      .option("--status <code>", "Fulfill matching requests with an HTTP status")
      .option("--content-type <type>", "Fulfill matching requests with a content-type"),
  ).action(
    async (
      pattern: string,
      options: {
        session?: string;
        abort?: boolean;
        body?: string;
        bodyFile?: string;
        headersFile?: string;
        method?: string;
        status?: string;
        contentType?: string;
      },
      command: Command,
    ) => {
      try {
        const sessionName = requireSessionName(options, command);
        const body =
          options.bodyFile !== undefined
            ? await readFile(resolve(options.bodyFile), "utf8")
            : options.body;
        const headers =
          options.headersFile !== undefined
            ? (JSON.parse(await readFile(resolve(options.headersFile), "utf8")) as Record<
                string,
                string
              >)
            : undefined;
        printCommandResult(
          "route add",
          await managedRoute("add", {
            sessionName,
            pattern,
            abort: options.abort,
            body,
            status: options.status ? Number(options.status) : undefined,
            contentType: options.contentType,
            headers,
            method: options.method,
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
    route.command("load <file>").description("Load multiple route specs from a JSON file"),
  ).action(async (file: string, options: { session?: string }, command: Command) => {
    try {
      const sessionName = requireSessionName(options, command);
      const path = resolve(file);
      const dir = dirname(path);
      const specs = JSON.parse(await readFile(path, "utf8")) as Array<Record<string, unknown>>;
      const loaded = [];
      for (const spec of specs) {
        if (typeof spec.pattern !== "string" || !spec.pattern) {
          throw new Error("route load requires every route spec to include a non-empty pattern");
        }
        const body =
          typeof spec.bodyFile === "string"
            ? await readFile(resolve(dir, spec.bodyFile), "utf8")
            : typeof spec.body === "string"
              ? spec.body
              : undefined;
        const headers =
          typeof spec.headersFile === "string"
            ? (JSON.parse(await readFile(resolve(dir, spec.headersFile), "utf8")) as Record<
                string,
                string
              >)
            : spec.headers && typeof spec.headers === "object"
              ? (spec.headers as Record<string, string>)
              : undefined;
        const result = await managedRoute("add", {
          sessionName,
          pattern: spec.pattern,
          abort: Boolean(spec.abort),
          body,
          status: spec.status !== undefined ? Number(spec.status) : undefined,
          contentType: typeof spec.contentType === "string" ? spec.contentType : undefined,
          headers,
          method: typeof spec.method === "string" ? spec.method : undefined,
        });
        loaded.push(result.data.route ?? { pattern: spec.pattern });
      }
      printCommandResult("route load", {
        session: {
          scope: "managed",
          name: sessionName,
          default: sessionName === "default",
        },
        data: {
          loadedCount: loaded.length,
          routes: loaded,
        },
      });
    } catch (error) {
      printSessionAwareCommandError("route load", error, {
        code: "ROUTE_LOAD_FAILED",
        message: "route load failed",
        suggestions: [
          "Use a JSON array of route specs",
          "Resolve bodyFile and headersFile relative to the JSON file",
        ],
      });
      process.exitCode = 1;
    }
  });

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
