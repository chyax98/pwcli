import type { Command } from "commander";
import { sessionRoutingError } from "../session/routing.js";
import { printCommandError } from "../utils/output.js";

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
