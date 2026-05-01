import type { Command } from "commander";
import { managedNetwork } from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerNetworkCommand(program: Command): void {
  addSessionOption(
    program
      .command("network")
      .description("Show recent network activity from a named managed session")
      .option("--request-id <id>", "Return detail for one request id")
      .option("--url <substring>", "Filter by URL substring")
      .option("--kind <kind>", "Filter by request|response|requestfailed")
      .option("--method <method>", "Filter by HTTP method")
      .option("--status <code>", "Filter by HTTP status")
      .option("--resource-type <type>", "Filter by Playwright resource type")
      .option("--text <text>", "Filter by URL or failure text")
      .option("--since <iso>", "Keep only records at or after the given ISO timestamp")
      .option("--current", "Only show records from the current page navigation")
      .option("--limit <n>", "Limit result sample size"),
  ).action(
    async (options: {
      session?: string;
      requestId?: string;
      url?: string;
      kind?: "request" | "response" | "requestfailed" | "console-resource-error";
      method?: string;
      status?: string;
      resourceType?: string;
      text?: string;
      since?: string;
      current?: boolean;
      limit?: string;
    }) => {
      try {
        const sessionName = requireSessionName(options);
        printCommandResult(
          "network",
          await managedNetwork({
            sessionName,
            requestId: options.requestId,
            url: options.url,
            kind: options.kind,
            method: options.method,
            status: options.status,
            resourceType: options.resourceType,
            text: options.text,
            since: options.since,
            current: options.current,
            limit: options.limit ? Number(options.limit) : undefined,
          }),
        );
      } catch (error) {
        printSessionAwareCommandError("network", error, {
          code: "NETWORK_FAILED",
          message: "network failed",
          suggestions: ["Run `pw session create <name> --open <url>` first"],
        });
        process.exitCode = 1;
      }
    },
  );
}
