import type { Command } from "commander";
import { sessionRoutingError } from "../../domain/session/routing.js";
import { MAX_SESSION_NAME_LENGTH } from "../../infra/playwright/cli-client.js";
import { printCommandError } from "../output.js";

export function addSessionOption<T extends Command>(command: T): T {
  return command.option("-s, --session <name>", "Target managed session");
}

export function requireSessionName(
  options: { session?: string },
  command?: Pick<Command, "optsWithGlobals">,
) {
  const merged = command?.optsWithGlobals<{ session?: string }>();
  const sessionName = merged?.session?.trim() || options.session?.trim();
  if (!sessionName) {
    throw new Error("SESSION_REQUIRED");
  }
  if (sessionName.length > MAX_SESSION_NAME_LENGTH) {
    throw new Error(`SESSION_NAME_TOO_LONG:${sessionName}:${MAX_SESSION_NAME_LENGTH}`);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionName)) {
    throw new Error(`SESSION_NAME_INVALID:${sessionName}`);
  }
  return sessionName;
}

export function printSessionAwareCommandError(
  command: string,
  error: unknown,
  fallback: {
    code: string;
    message: string;
    suggestions?: string[];
    details?: Record<string, unknown>;
  },
) {
  const message = error instanceof Error ? error.message : String(error);
  const routing = sessionRoutingError(message);
  if (routing) {
    printCommandError(command, routing);
    return;
  }

  printCommandError(command, {
    code: fallback.code,
    message: error instanceof Error ? error.message : fallback.message,
    suggestions: fallback.suggestions,
    details: fallback.details,
  });
}
