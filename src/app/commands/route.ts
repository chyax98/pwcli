import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Command } from "commander";
import { managedRoute } from "../../infra/playwright/runtime.js";
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
      .option("--match-body <text>", "Only match when request postData contains the substring")
      .option(
        "--match-query <key=value>",
        "Only match when the request URL query contains the exact key/value pair",
        (value, acc) => {
          acc.push(value);
          return acc;
        },
        [] as string[],
      )
      .option(
        "--match-header <key=value>",
        "Only match when the request headers contain the exact key/value pair",
        (value, acc) => {
          acc.push(value);
          return acc;
        },
        [] as string[],
      )
      .option("--match-json <json>", "Only match when parsed request JSON contains this subset")
      .option("--match-json-file <path>", "Load JSON subset matcher from a file")
      .option("--patch-json <json>", "Fetch upstream response and apply a JSON merge patch")
      .option(
        "--patch-json-file <path>",
        "Fetch upstream response and apply a JSON merge patch loaded from a file",
      )
      .option(
        "--patch-text <from=to>",
        "Fetch upstream text response and replace one substring",
        (value, acc) => {
          acc.push(value);
          return acc;
        },
        [] as string[],
      )
      .option("--patch-status <code>", "Override upstream status while preserving or patching body")
      .option("--body <text>", "Fulfill matching requests with a text body")
      .option("--body-file <path>", "Fulfill matching requests with body loaded from a file")
      .option(
        "--headers-file <path>",
        "Fulfill matching requests with headers loaded from a JSON file",
      )
      .option(
        "--merge-headers-file <path>",
        "Merge response headers loaded from a JSON file when patching upstream responses",
      )
      .option(
        "--inject-headers-file <path>",
        "Continue matching requests with request headers merged from a JSON file",
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
        matchBody?: string;
        matchQuery?: string[];
        matchHeader?: string[];
        matchJson?: string;
        matchJsonFile?: string;
        patchJson?: string;
        patchJsonFile?: string;
        patchText?: string[];
        patchStatus?: string;
        body?: string;
        bodyFile?: string;
        headersFile?: string;
        mergeHeadersFile?: string;
        injectHeadersFile?: string;
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
        const patchJson =
          options.patchJsonFile !== undefined
            ? JSON.parse(await readFile(resolve(options.patchJsonFile), "utf8"))
            : options.patchJson !== undefined
              ? JSON.parse(options.patchJson)
              : undefined;
        const patchText = parseKeyValuePairs(options.patchText);
        const matchJson =
          options.matchJsonFile !== undefined
            ? JSON.parse(await readFile(resolve(options.matchJsonFile), "utf8"))
            : options.matchJson !== undefined
              ? JSON.parse(options.matchJson)
              : undefined;
        const headers =
          options.headersFile !== undefined
            ? (JSON.parse(await readFile(resolve(options.headersFile), "utf8")) as Record<
                string,
                string
              >)
            : undefined;
        const mergeHeaders =
          options.mergeHeadersFile !== undefined
            ? (JSON.parse(await readFile(resolve(options.mergeHeadersFile), "utf8")) as Record<
                string,
                string
              >)
            : undefined;
        const injectHeaders =
          options.injectHeadersFile !== undefined
            ? (JSON.parse(await readFile(resolve(options.injectHeadersFile), "utf8")) as Record<
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
            matchBody: options.matchBody,
            matchQuery: parseKeyValuePairs(options.matchQuery),
            matchHeaders: parseKeyValuePairs(options.matchHeader),
            matchJson,
            patchJson,
            patchText,
            patchStatus: options.patchStatus ? Number(options.patchStatus) : undefined,
            body,
            status: options.status ? Number(options.status) : undefined,
            contentType: options.contentType,
            headers,
            mergeHeaders,
            injectHeaders,
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
            "Or inject request headers with `--inject-headers-file` for pass-through reproduction",
            "Or patch an upstream JSON response with `--patch-json-file`",
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
        const patchJson =
          typeof spec.patchJsonFile === "string"
            ? JSON.parse(await readFile(resolve(dir, spec.patchJsonFile), "utf8"))
            : spec.patchJson !== undefined
              ? spec.patchJson
              : undefined;
        const patchText = Array.isArray(spec.patchText)
          ? parseKeyValuePairs(spec.patchText as string[])
          : undefined;
        const matchJson =
          typeof spec.matchJsonFile === "string"
            ? JSON.parse(await readFile(resolve(dir, spec.matchJsonFile), "utf8"))
            : spec.matchJson !== undefined
              ? spec.matchJson
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
        const mergeHeaders =
          typeof spec.mergeHeadersFile === "string"
            ? (JSON.parse(await readFile(resolve(dir, spec.mergeHeadersFile), "utf8")) as Record<
                string,
                string
              >)
            : spec.mergeHeaders && typeof spec.mergeHeaders === "object"
              ? (spec.mergeHeaders as Record<string, string>)
              : undefined;
        const injectHeaders =
          typeof spec.injectHeadersFile === "string"
            ? (JSON.parse(await readFile(resolve(dir, spec.injectHeadersFile), "utf8")) as Record<
                string,
                string
              >)
            : spec.injectHeaders && typeof spec.injectHeaders === "object"
              ? (spec.injectHeaders as Record<string, string>)
              : undefined;
        const result = await managedRoute("add", {
          sessionName,
          pattern: spec.pattern,
          abort: Boolean(spec.abort),
          matchBody: typeof spec.matchBody === "string" ? spec.matchBody : undefined,
          matchQuery: Array.isArray(spec.matchQuery)
            ? parseKeyValuePairs(spec.matchQuery as string[])
            : undefined,
          matchHeaders: Array.isArray(spec.matchHeaders)
            ? parseKeyValuePairs(spec.matchHeaders as string[])
            : undefined,
          matchJson,
          patchJson,
          patchText,
          patchStatus: spec.patchStatus !== undefined ? Number(spec.patchStatus) : undefined,
          body,
          status: spec.status !== undefined ? Number(spec.status) : undefined,
          contentType: typeof spec.contentType === "string" ? spec.contentType : undefined,
          headers,
          mergeHeaders,
          injectHeaders,
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

function parseKeyValuePairs(values?: string[]) {
  if (!values?.length) {
    return undefined;
  }
  return Object.fromEntries(
    values.map((value) => {
      const index = value.indexOf("=");
      if (index <= 0) {
        throw new Error(`invalid key=value pair: ${value}`);
      }
      return [value.slice(0, index).trim().toLowerCase(), value.slice(index + 1).trim()];
    }),
  );
}
